from sqlalchemy import Column, String, Integer, DateTime, JSON, Boolean, ForeignKey, create_engine, Uuid
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from config import get_settings
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone_number = Column(String, unique=True, nullable=False)
    city = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    profiles = relationship("PatientProfile", back_populates="user")
    sessions = relationship("ConsultationSession", back_populates="user")

class PatientProfile(Base):
    __tablename__ = 'patient_profiles'
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid(as_uuid=True), ForeignKey('users.id'), nullable=True)
    age = Column(Integer)
    gender = Column(String)
    region = Column(String)
    occupation = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="profiles")

class ConsultationSession(Base):
    __tablename__ = 'consultation_sessions'
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(Uuid(as_uuid=True), ForeignKey('patient_profiles.id'))
    user_id = Column(Uuid(as_uuid=True), ForeignKey('users.id'), nullable=True)
    session_data = Column(JSON)
    root_causes = Column(JSON)
    protocols_recommended = Column(JSON)
    completed_at = Column(DateTime)
    need_practitioner = Column(Boolean)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="sessions")

settings = get_settings()

def create_db_engine(db_url: str):
    if db_url.startswith("sqlite"):
        return create_engine(
            db_url,
            connect_args={"check_same_thread": False}
        )
    else:
        return create_engine(
            db_url,
            connect_args={"connect_timeout": 15}
        )

engine = None
SessionLocal = None

try:
    engine = create_db_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception as e:
    logger.warning(f"Could not create initial DB engine for {settings.DATABASE_URL}: {e}")

def init_db():
    """Initialize database tables. If PostgreSQL is unreachable, fall back to SQLite."""
    global engine, SessionLocal
    
    if engine is not None:
        try:
            Base.metadata.create_all(bind=engine)
            logger.info(f"Successfully initialized database tables using {engine.url}")
            return
        except Exception as e:
            logger.warning(f"⚠️ Primary DB connection failed ({settings.DATABASE_URL}): {e}")

    # Fallback to local SQLite database if PostgreSQL fails
    fallback_url = "sqlite:///./holistic_health.db"
    try:
        logger.info(f"Falling back to local SQLite database ({fallback_url})...")
        engine = create_db_engine(fallback_url)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)
        logger.info("Successfully created local SQLite database (holistic_health.db) with required tables.")
    except Exception as fallback_err:
        logger.error(f"Failed to initialize fallback SQLite database: {fallback_err}")

def get_db():
    if not SessionLocal:
        yield None
        return
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class PatientProfileRepository:
    def __init__(self, db_session):
        self.db = db_session
        
    def create_profile(self, **kwargs):
        if not self.db: return None
        profile = PatientProfile(**kwargs)
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        return profile
        
    def get_profile(self, profile_id):
        if not self.db: return None
        return self.db.query(PatientProfile).filter(PatientProfile.id == profile_id).first()

