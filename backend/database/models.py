from sqlalchemy import Column, String, Integer, DateTime, JSON, Boolean, ForeignKey, create_engine, Uuid, text, inspect, Sequence, Text
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
    case_id = Column(Integer, Sequence('consultation_sessions_case_id_seq'), unique=True)
    
    user = relationship("User", back_populates="sessions")

class PrescriptionTemplate(Base):
    __tablename__ = 'prescription_templates'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False)  # e.g. "Heart Disease", "Arthritis"
    prescription_text = Column(Text, nullable=False)
    safety_precautions = Column(Text, default='')
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

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
            connect_args={"connect_timeout": 15},
            pool_pre_ping=True,
            pool_recycle=3600
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
            if "case_id" not in columns:
                if bind_engine.dialect.name == 'postgresql':
                    conn.execute(text("ALTER TABLE consultation_sessions ADD COLUMN case_id SERIAL UNIQUE"))
                else:
                    conn.execute(text("ALTER TABLE consultation_sessions ADD COLUMN case_id INTEGER"))
                logger.info("Added case_id column to consultation_sessions table")
    except Exception as e:
        logger.warning(f"Failed to auto-migrate consultation_sessions table: {e}")

def seed_templates(db_session):
    if db_session.query(PrescriptionTemplate).first():
        return
        
    templates = [
        PrescriptionTemplate(
            name="Heart Disease — Cardiovascular Wellness Protocol",
            category="Heart Disease",
            prescription_text="AYUSH CARDIOVASCULAR WELLNESS PROTOCOL\n======================================\n\n1. HERBAL MEDICINES:\n- Arjuna (Terminalia arjuna) bark powder — 500mg twice daily with warm water\n- Ashwagandha (Withania somnifera) — 300mg twice daily for stress-induced cardiac load\n- Garlic (Allium sativum) — 2 raw cloves morning on empty stomach\n- Guggulu (Commiphora mukul) — 500mg twice daily for cholesterol management\n\n2. DIETARY GUIDELINES:\n- Follow a low-sodium, plant-rich diet (DASH-style)\n- Include omega-3 sources: flaxseeds, walnuts, chia seeds\n- Avoid: fried foods, trans fats, excess caffeine, refined sugar\n- Include: oats, barley, green leafy vegetables, pomegranate\n- Drink warm lemon water with turmeric every morning\n\n3. LIFESTYLE MODIFICATIONS:\n- Brisk walking 30 min/day (avoid strenuous exercise without medical clearance)\n- Pranayama: Anulom-Vilom 10 min, Bhramari 5 min daily\n- Meditation: 15 min guided heart-coherence meditation\n- Sleep: 7-8 hours, consistent schedule\n\n4. FOLLOW-UP:\n- Review in 21 days\n- Monitor blood pressure daily\n- Get lipid profile test after 30 days",
            safety_precautions="Do NOT stop any prescribed allopathic cardiac medication without consulting your cardiologist. Arjuna may interact with blood-thinning medications. Contraindicated in pregnancy. Monitor blood pressure regularly."
        ),
        PrescriptionTemplate(
            name="Arthritis — Joint Health & Inflammation Protocol",
            category="Arthritis",
            prescription_text="AYUSH JOINT HEALTH & INFLAMMATION PROTOCOL\n===========================================\n\n1. HERBAL MEDICINES:\n- Shallaki (Boswellia serrata) — 400mg three times daily\n- Guggulu (Yograj Guggulu) — 2 tablets twice daily after meals\n- Turmeric (Curcuma longa) — 1000mg curcumin with black pepper extract daily\n- Nirgundi (Vitex negundo) oil — external application on affected joints\n\n2. DIETARY GUIDELINES:\n- Anti-inflammatory diet: include ginger, turmeric, garlic in cooking\n- Avoid: nightshade vegetables (tomatoes, potatoes, eggplant), refined sugar, processed foods\n- Include: warm soups, bone broth (if non-vegetarian), sesame seeds, green gram\n- Drink warm water throughout the day (avoid cold beverages)\n\n3. PANCHAKARMA THERAPY (if available):\n- Abhyanga (oil massage) with Mahanarayan oil — weekly\n- Pinda Sweda (herbal bolus fomentation) — as per practitioner guidance\n- Janu Basti (for knee joints) — 7-session course recommended\n\n4. LIFESTYLE MODIFICATIONS:\n- Gentle yoga: Pawanmuktasana series, Trikonasana, Virabhadrasana (modified)\n- Avoid: prolonged sitting, heavy lifting, cold/damp exposure\n- Warm compress on affected joints for 15 min twice daily\n\n5. FOLLOW-UP:\n- Review in 14 days\n- ESR/CRP blood test after 30 days",
            safety_precautions="Guggulu is contraindicated in pregnancy and active liver disease. Boswellia may interact with NSAIDs — inform if taking ibuprofen/diclofenac. Stop herbal medicines 2 weeks before any planned surgery."
        ),
        PrescriptionTemplate(
            name="Eye Health — Vision Care & Strain Protocol",
            category="Eye Problem",
            prescription_text="AYUSH EYE HEALTH & VISION CARE PROTOCOL\n========================================\n\n1. HERBAL MEDICINES:\n- Triphala Churna — 1 tsp with warm water at bedtime (detox + eye tonic)\n- Saptamrit Lauh — 1 tablet twice daily (Ayurvedic eye supplement)\n- Amalaki (Indian Gooseberry) — 500mg twice daily (Vitamin C for eye health)\n- Rose water eye drops — 2 drops each eye, morning and evening\n\n2. DIETARY GUIDELINES:\n- Include: carrots, spinach, sweet potatoes, bell peppers (beta-carotene rich)\n- Include: almonds (soaked), walnuts, flaxseeds (omega-3 for retinal health)\n- Avoid: excessive screen time snacking, refined sugar, excess caffeine\n- Drink amla juice (20ml) with honey every morning\n\n3. EYE EXERCISES (Trataka & Yoga):\n- Palming: Rub palms, cup over closed eyes for 3 min — repeat 3x daily\n- Trataka (candle gazing): 5 min daily for focus and tear production\n- 20-20-20 Rule: Every 20 min, look at something 20 feet away for 20 seconds\n- Eye rotations: clockwise and anticlockwise, 10 rounds each\n\n4. LIFESTYLE MODIFICATIONS:\n- Reduce screen brightness, use blue-light filter after 6 PM\n- Sleep: minimum 7 hours (critical for eye recovery)\n- Wash eyes with Triphala-infused cool water in the morning\n\n5. FOLLOW-UP:\n- Review in 21 days\n- Ophthalmologist checkup recommended if no improvement in 30 days",
            safety_precautions="Rose water drops must be pharmaceutical-grade sterile. Do NOT use if any eye infection/redness is present — consult an ophthalmologist first. Triphala may cause loose stools initially — reduce dose if needed."
        ),
        PrescriptionTemplate(
            name="Body Pain — Musculoskeletal Pain Management Protocol",
            category="Body Pain",
            prescription_text="AYUSH MUSCULOSKELETAL PAIN MANAGEMENT PROTOCOL\n===============================================\n\n1. HERBAL MEDICINES:\n- Dashmoola Kwath — 30ml twice daily before meals (anti-inflammatory decoction)\n- Ashwagandha — 500mg twice daily (muscle recovery + stress relief)\n- Maharasnadi Kwath — 15ml twice daily (nerve & muscle pain)\n- Mahanarayan Oil — external application with gentle massage on painful areas\n\n2. DIETARY GUIDELINES:\n- Anti-inflammatory diet: turmeric milk (golden latte) at bedtime\n- Include: ginger tea, garlic, green leafy vegetables, sesame seeds\n- Avoid: cold foods, fermented foods, excess salt, packaged/processed foods\n- Hydration: warm water infused with ajwain (carom seeds) — sip throughout day\n\n3. THERAPY RECOMMENDATIONS:\n- Abhyanga (warm oil massage) — 2-3 times per week\n- Hot fomentation / steam on affected areas — 15 min daily\n- Epsom salt bath — 2 cups in warm bath, soak 20 min, twice weekly\n\n4. YOGA & MOVEMENT:\n- Gentle stretching: Cat-Cow, Child's Pose, Supta Matsyendrasana\n- Surya Namaskar (slow pace) — 5 rounds daily\n- Avoid: high-impact exercise, heavy lifting, prolonged static postures\n\n5. FOLLOW-UP:\n- Review in 14 days\n- If pain persists beyond 3 weeks, recommend X-ray/MRI of affected area",
            safety_precautions="Dashmoola is contraindicated in pregnancy. Maharasnadi Kwath should not be taken with blood-thinning medication. If pain is sudden/severe with numbness or tingling, seek immediate medical attention — do NOT self-treat."
        )
    ]
    db_session.add_all(templates)
    db_session.commit()
    logger.info("Seeded 4 default prescription templates.")

def init_db():
    """Initialize database tables. If PostgreSQL is unreachable, fall back to SQLite."""
    global engine, SessionLocal
    
    if engine is not None:
        try:
            Base.metadata.create_all(bind=engine)
            run_migrations(engine)
            with SessionLocal() as db_session:
                seed_templates(db_session)
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
        with SessionLocal() as db_session:
            seed_templates(db_session)
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

