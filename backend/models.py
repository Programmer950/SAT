from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, UniqueConstraint, Float, ARRAY, Text
from sqlalchemy.orm import relationship
import datetime
from database import Base

class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    sessions = relationship("Session", back_populates="teacher")

class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    course_code = Column(String, index=True)
    room = Column(String)
    duration_minutes = Column(Integer)
    session_date = Column(Date, default=datetime.date.today, nullable=False)
    start_time = Column(String, nullable=True)
    end_time = Column(String, nullable=True)
    secret = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="CASCADE"), nullable=True)

    teacher = relationship("Teacher", back_populates="sessions")
    attendances = relationship("Attendance", back_populates="session", cascade="all, delete-orphan")

class Attendance(Base):
    __tablename__ = "attendances"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    roll_no = Column(String, index=True)
    name = Column(String)
    email = Column(String)
    device_id = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    platform = Column(String(20), default="android")
    device_fingerprint = Column(String(255), nullable=True)
    client_lat = Column(Float, nullable=True)
    client_lng = Column(Float, nullable=True)
    distance_meters = Column(Integer, nullable=True)
    is_flagged = Column(Boolean, default=False)
    flag_reasons = Column(ARRAY(String), default=list)
    selfie_url = Column(Text, nullable=True)
    verification_status = Column(String(30), default="CLEAN")

    __table_args__ = (
        UniqueConstraint('session_id', 'roll_no', name='uix_session_roll_no'),
        UniqueConstraint('session_id', 'device_id', name='uix_session_device_id'),
    )

    session = relationship("Session", back_populates="attendances")
