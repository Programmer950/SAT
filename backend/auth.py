from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
import models
from database import get_db

SECRET_KEY = "supersecretkey_please_change_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/teacher/login")

router = APIRouter(prefix="/api/teacher", tags=["Teacher"])

class TeacherCreate(BaseModel):
    name: str
    email: str
    password: str

class TeacherLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    teacher: dict

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_teacher(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.Teacher:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    teacher = db.query(models.Teacher).filter(models.Teacher.email == email).first()
    if teacher is None:
        raise credentials_exception
    return teacher

@router.post("/signup", response_model=Token)
def signup(teacher: TeacherCreate, db: Session = Depends(get_db)):
    db_teacher = db.query(models.Teacher).filter(models.Teacher.email == teacher.email).first()
    if db_teacher:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(teacher.password)
    new_teacher = models.Teacher(
        name=teacher.name,
        email=teacher.email,
        hashed_password=hashed_password
    )
    db.add(new_teacher)
    db.commit()
    db.refresh(new_teacher)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_teacher.email}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "teacher": {"id": new_teacher.id, "name": new_teacher.name, "email": new_teacher.email}
    }

@router.post("/login", response_model=Token)
def login(teacher_data: TeacherLogin, db: Session = Depends(get_db)):
    teacher = db.query(models.Teacher).filter(models.Teacher.email == teacher_data.email).first()
    if not teacher or not verify_password(teacher_data.password, teacher.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": teacher.email}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "teacher": {"id": teacher.id, "name": teacher.name, "email": teacher.email}
    }
