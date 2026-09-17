import os
import hmac
import hashlib
import time
import math
import secrets
import asyncio
import json
from datetime import datetime, date
from typing import Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from pydantic import BaseModel
import pandas as pd
import openpyxl

import models
import database
import auth
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Smart Attendance Tracking API")

app.include_router(auth.router)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for active WebSocket connections
class ConnectionManager:
    def __init__(self):
        # session_id -> list of websockets (for teacher dashboards)
        self.teacher_connections: Dict[int, List[WebSocket]] = {}
        # session_id -> list of websockets (for qr displays, though usually just 1)
        self.qr_connections: Dict[int, List[WebSocket]] = {}

    async def connect_teacher(self, websocket: WebSocket, session_id: int):
        await websocket.accept()
        if session_id not in self.teacher_connections:
            self.teacher_connections[session_id] = []
        self.teacher_connections[session_id].append(websocket)

    def disconnect_teacher(self, websocket: WebSocket, session_id: int):
        if session_id in self.teacher_connections:
            if websocket in self.teacher_connections[session_id]:
                self.teacher_connections[session_id].remove(websocket)

    async def broadcast_to_teacher(self, session_id: int, message: dict):
        if session_id in self.teacher_connections:
            for connection in self.teacher_connections[session_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

    async def connect_qr(self, websocket: WebSocket, session_id: int):
        await websocket.accept()
        if session_id not in self.qr_connections:
            self.qr_connections[session_id] = []
        self.qr_connections[session_id].append(websocket)

    def disconnect_qr(self, websocket: WebSocket, session_id: int):
        if session_id in self.qr_connections:
            if websocket in self.qr_connections[session_id]:
                self.qr_connections[session_id].remove(websocket)

manager = ConnectionManager()

# Pydantic Schemas
class SessionCreate(BaseModel):
    course_code: str
    room: str
    duration_minutes: int
    session_date: date
    start_time: str
    end_time: str

class SessionResponse(BaseModel):
    id: int
    course_code: str
    room: str
    duration_minutes: int
    session_date: date
    start_time: str
    end_time: str
    teacher_id: Optional[int] = None
    created_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True

class CheckinRequest(BaseModel):
    session_id: int
    roll_no: str
    name: str
    email: str
    device_id: str
    token: str
    platform: Optional[str] = "android"
    device_fingerprint: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    selfie_url: Optional[str] = None

def generate_totp(secret: str, time_step: int) -> str:
    """Generate an HMAC-SHA256 based TOTP rotated every 5 seconds"""
    msg = str(time_step).encode('utf-8')
    key = secret.encode('utf-8')
    h = hmac.new(key, msg, hashlib.sha256).hexdigest()
    return h[:8]


@app.post("/api/sessions", response_model=SessionResponse)
def create_session(session_data: SessionCreate, db: Session = Depends(get_db), current_teacher: models.Teacher = Depends(auth.get_current_teacher)):
    secret = secrets.token_hex(16)
    db_session = models.Session(
        course_code=session_data.course_code,
        room=session_data.room,
        duration_minutes=session_data.duration_minutes,
        session_date=session_data.session_date,
        start_time=session_data.start_time,
        end_time=session_data.end_time,
        teacher_id=current_teacher.id,
        secret=secret
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@app.post("/api/sessions/{session_id}/end")
def end_session(session_id: int, db: Session = Depends(get_db)):
    db_session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    db_session.is_active = False
    db.commit()
    return {"status": "success", "message": "Session ended"}

@app.get("/api/teacher/sessions")
def get_teacher_sessions(db: Session = Depends(get_db), current_teacher: models.Teacher = Depends(auth.get_current_teacher)):
    sessions = db.query(models.Session).filter(models.Session.teacher_id == current_teacher.id).order_by(models.Session.session_date.desc(), models.Session.created_at.desc()).all()
    
    result = []
    for s in sessions:
        result.append({
            "id": s.id,
            "course_code": s.course_code,
            "room": s.room,
            "session_date": s.session_date.isoformat() if s.session_date else None,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "is_active": s.is_active,
            "attendees_count": len(s.attendances)
        })
    return result

@app.get("/api/teacher/sessions/{session_id}/records")
def get_session_records(session_id: int, db: Session = Depends(get_db), current_teacher: models.Teacher = Depends(auth.get_current_teacher)):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.teacher_id != current_teacher.id:
        raise HTTPException(status_code=403, detail="Not authorized to view these records")
    
    records = []
    for a in session.attendances:
        records.append({
            "id": a.id,
            "roll_no": a.roll_no,
            "name": a.name,
            "email": a.email,
            "timestamp": a.timestamp.isoformat(),
            "device_id": a.device_id,
            "platform": a.platform,
            "is_flagged": a.is_flagged,
            "verification_status": a.verification_status,
            "flag_reasons": a.flag_reasons,
            "has_selfie": bool(a.selfie_url)
        })
    return records

@app.websocket("/ws/qr/{session_id}")
async def qr_endpoint(websocket: WebSocket, session_id: int, db: Session = Depends(get_db)):
    await manager.connect_qr(websocket, session_id)
    
    # Fetch session to get secret
    # Using threadpool for sync DB access in async endpoint might be needed for scale,
    # but simple query is fine for now
    db_session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not db_session or not db_session.is_active:
        await websocket.close(code=1008, reason="Session inactive or not found")
        return

    secret = db_session.secret
    try:
        while True:
            current_time = int(time.time())
            time_step = math.floor(current_time / 5)
            token = generate_totp(secret, time_step)
            
            # Send current token and time left in this 5 second window
            time_left = 5 - (current_time % 5)
            await websocket.send_json({
                "token": token,
                "expires_in": time_left,
                "session_id": session_id
            })
            
            await asyncio.sleep(1) # Send update every second to update UI timer
    except WebSocketDisconnect:
        manager.disconnect_qr(websocket, session_id)

@app.websocket("/ws/teacher/{session_id}")
async def teacher_endpoint(websocket: WebSocket, session_id: int):
    await manager.connect_teacher(websocket, session_id)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_teacher(websocket, session_id)

@app.post("/api/attendance/submit")
async def submit_attendance(req: CheckinRequest, db: Session = Depends(get_db)):
    if not req.email.strip().lower().endswith("@rajalakshmi.edu.in"):
        raise HTTPException(status_code=403, detail="Invalid domain. Must use @rajalakshmi.edu.in")

    # 1. Validate session (offloaded to threadpool — sync DB call)
    db_session = await run_in_threadpool(
        lambda: db.query(models.Session).filter(models.Session.id == req.session_id).first()
    )
    if not db_session or not db_session.is_active:
        raise HTTPException(status_code=400, detail="Invalid or inactive session")

    # 2. Sliding window TOTP validation (current, -1, -2) for 15s window
    current_time = int(time.time())
    current_step = math.floor(current_time / 5)
    
    valid = False
    for step_offset in [0, -1, -2]:
        expected_token = generate_totp(db_session.secret, current_step + step_offset)
        if hmac.compare_digest(expected_token, req.token):
            valid = True
            break
            
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    # 3. Enforce strict single-device limit for ANDROID (offloaded)
    if req.platform == "android":
        existing_device = await run_in_threadpool(
            lambda: db.query(models.Attendance).filter(
                models.Attendance.session_id == req.session_id,
                models.Attendance.device_id == req.device_id
            ).first()
        )
        if existing_device:
            raise HTTPException(
                status_code=409,
                detail=f"Device already registered for student {existing_device.roll_no}. One scan per device permitted."
            )

    # 4. Check for duplicate roll number across all platforms (offloaded)
    existing_roll = await run_in_threadpool(
        lambda: db.query(models.Attendance).filter(
            models.Attendance.session_id == req.session_id,
            models.Attendance.roll_no == req.roll_no
        ).first()
    )
    if existing_roll:
        raise HTTPException(status_code=400, detail="Attendance already marked for this roll number.")

    # 5. Soft verification / Flagging logic applies ONLY to iOS Web
    flags = []

    if req.platform == "ios_web":
        if req.device_fingerprint:
            device_used = await run_in_threadpool(
                lambda: db.query(models.Attendance).filter(
                    models.Attendance.session_id == req.session_id,
                    models.Attendance.roll_no != req.roll_no,
                    models.Attendance.device_fingerprint == req.device_fingerprint
                ).first()
            )
            if device_used:
                flags.append("Duplicate hardware signature detected")

        # Rule for Selfie Challenge
        if "Duplicate hardware signature detected" in flags and not req.selfie_url:
            return {
                "status": "SELFIE_REQUIRED",
                "message": "Hardware anomaly detected. Live photo verification required.",
                "flag_reasons": flags
            }

    is_flagged = len(flags) > 0
    verification_status = "FLAGGED" if is_flagged else "CLEAN"

    # 6. Record attendance — commit/refresh offloaded to threadpool
    new_attendance = models.Attendance(
        session_id=req.session_id,
        roll_no=req.roll_no,
        name=req.name,
        email=req.email,
        device_id=req.device_id,
        platform=req.platform,
        device_fingerprint=req.device_fingerprint,
        client_lat=None,
        client_lng=None,
        distance_meters=None,
        is_flagged=is_flagged,
        flag_reasons=flags,
        selfie_url=req.selfie_url,
        verification_status=verification_status
    )
    db.add(new_attendance)
    try:
        await run_in_threadpool(db.commit)
        await run_in_threadpool(db.refresh, new_attendance)
    except IntegrityError:
        await run_in_threadpool(db.rollback)
        raise HTTPException(status_code=409, detail="Database integrity error. Duplicate attendance.")

    # 7. Broadcast to teacher (non-blocking — event loop now free)
    await manager.broadcast_to_teacher(req.session_id, {
        "id": new_attendance.id,
        "roll_no": req.roll_no,
        "name": req.name,
        "timestamp": new_attendance.timestamp.isoformat(),
        "platform": req.platform,
        "is_flagged": is_flagged,
        "verification_status": verification_status,
        "flag_reasons": flags,
        "has_selfie": bool(req.selfie_url)
    })

    return {
        "status": "SUCCESS",
        "course_name": db_session.course_code,
        "room": db_session.room,
        "session_date": db_session.session_date.isoformat() if db_session.session_date else "N/A",
        "start_time": db_session.start_time or "N/A",
        "end_time": db_session.end_time or "N/A",
        "session_id": str(db_session.id),
        "roll_no": req.roll_no,
        "name": req.name,
        "timestamp": new_attendance.timestamp.isoformat()
    }

@app.get("/api/attendance/{attendance_id}/selfie")
def get_attendance_selfie(attendance_id: int, db: Session = Depends(get_db)):
    attendance = db.query(models.Attendance).filter(models.Attendance.id == attendance_id).first()
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    return {"selfie_url": attendance.selfie_url}

@app.delete("/api/attendance/{attendance_id}")
def delete_attendance(attendance_id: int, db: Session = Depends(get_db), current_teacher: models.Teacher = Depends(auth.get_current_teacher)):
    attendance = db.query(models.Attendance).filter(models.Attendance.id == attendance_id).first()
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    session = db.query(models.Session).filter(models.Session.id == attendance.session_id).first()
    if not session or session.teacher_id != current_teacher.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this record")

    db.delete(attendance)
    db.commit()
    return {"status": "success", "message": "Attendance revoked successfully"}

@app.patch("/api/attendance/{attendance_id}/verify")
def verify_attendance(attendance_id: int, db: Session = Depends(get_db), current_teacher: models.Teacher = Depends(auth.get_current_teacher)):
    attendance = db.query(models.Attendance).filter(models.Attendance.id == attendance_id).first()
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    session = db.query(models.Session).filter(models.Session.id == attendance.session_id).first()
    if not session or session.teacher_id != current_teacher.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this record")

    attendance.is_flagged = False
    attendance.verification_status = "VERIFIED"
    db.commit()
    return {"status": "success", "message": "Attendance marked as verified"}

@app.get("/api/attendance/export/{session_id}")
def export_attendance(session_id: int, db: Session = Depends(get_db)):
    db_session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    attendances = db.query(models.Attendance).filter(models.Attendance.session_id == session_id).all()
    
    data = []
    for a in attendances:
        data.append({
            "Roll Number": a.roll_no,
            "Name": a.name,
            "Timestamp": a.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        })
        
    df = pd.DataFrame(data)
    
    # Create export directory if not exists
    os.makedirs("exports", exist_ok=True)
    file_path = f"exports/attendance_session_{session_id}.xlsx"
    
    df.to_excel(file_path, index=False)
    
    return FileResponse(
        path=file_path, 
        filename=f"{db_session.course_code}_attendance.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
