from sqlalchemy import Column, String, Integer, DateTime, JSON, Boolean, ForeignKey, create_engine, Uuid, text, inspect
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from config import get_settings
import uuid
from datetime import datetime, timezone
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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="profiles")

class ConsultationSession(Base):
    __tablename__ = 'consultation_sessions'
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(Uuid(as_uuid=True), ForeignKey('patient_profiles.id'), nullable=True)
    user_id = Column(Uuid(as_uuid=True), ForeignKey('users.id'), nullable=True)
    session_data = Column(JSON)
    root_causes = Column(JSON)
    protocols_recommended = Column(JSON)
    completed_at = Column(DateTime, nullable=True)
    need_practitioner = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Practitioner portal integration
    status = Column(String, default='pending_review')  # 'pending_review', 'reviewed'
    doctor_prescription = Column(JSON, nullable=True)
    doctor_notes = Column(String, nullable=True)
    
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

def run_migrations(bind_engine):
    try:
        inspector = inspect(bind_engine)
        columns = [col["name"] for col in inspector.get_columns("consultation_sessions")]
        
        with bind_engine.begin() as conn:
            if "status" not in columns:
                conn.execute(text("ALTER TABLE consultation_sessions ADD COLUMN status VARCHAR DEFAULT 'pending_review'"))
                logger.info("Added status column to consultation_sessions table")
            if "doctor_prescription" not in columns:
                conn.execute(text("ALTER TABLE consultation_sessions ADD COLUMN doctor_prescription JSON"))
                logger.info("Added doctor_prescription column to consultation_sessions table")
            if "doctor_notes" not in columns:
                conn.execute(text("ALTER TABLE consultation_sessions ADD COLUMN doctor_notes VARCHAR"))
                logger.info("Added doctor_notes column to consultation_sessions table")
    except Exception as e:
        logger.warning(f"Failed to auto-migrate consultation_sessions table: {e}")

def init_db():
    """Initialize database tables. If PostgreSQL is unreachable, fall back to SQLite."""
    global engine, SessionLocal
    
    if engine is not None:
        try:
            Base.metadata.create_all(bind=engine)
            run_migrations(engine)
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
        run_migrations(engine)
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


def save_completed_session(db, session_id: str, user_id: str, state: dict):
    try:
        import uuid
        from sqlalchemy.orm import Session
        
        session_uuid = uuid.UUID(session_id)
        user_uuid = uuid.UUID(user_id)
        
        # 1. Create or get patient profile
        patient_info = state.get("patient_info", {})
        profile = db.query(PatientProfile).filter(PatientProfile.user_id == user_uuid).first()
        if not profile:
            profile = PatientProfile(
                user_id=user_uuid,
                age=patient_info.get("age", 30),
                gender=patient_info.get("gender", "other"),
                region=patient_info.get("region", "India"),
                occupation=patient_info.get("occupation", "Not specified")
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
            
        # 2. Create or update session
        session = db.query(ConsultationSession).filter(ConsultationSession.id == session_uuid).first()
        if not session:
            conv_history = state.get("conversation_history", [])
            
            session = ConsultationSession(
                id=session_uuid,
                patient_id=profile.id,
                user_id=user_uuid,
                session_data=conv_history,
                root_causes=state.get("root_causes", []),
                protocols_recommended=state.get("final_report", {}),
                completed_at=datetime.now(timezone.utc),
                need_practitioner=state.get("need_practitioner", False),
                status="pending_review"
            )
            db.add(session)
            db.commit()
            logger.info(f"Successfully saved completed session {session_id} to DB")
        return session
    except Exception as e:
        logger.error(f"Error saving completed session to DB: {e}", exc_info=True)
        db.rollback()
        return None

