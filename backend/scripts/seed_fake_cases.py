import os
import sys
import uuid
import json
from datetime import datetime, timezone, timedelta

# Add backend dir to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.models import SessionLocal, User, PatientProfile, ConsultationSession, engine, run_migrations

def seed_data():
    run_migrations(engine)
    db = SessionLocal()
    try:
        # 1. Delete existing treatment request data
        db.query(ConsultationSession).delete()
        
        # Optionally, delete fake users created previously (we won't delete techlead.ps@gmail.com)
        fake_emails = [f"fake{i}@example.com" for i in range(1, 6)]
        db.query(PatientProfile).filter(PatientProfile.user.has(User.email.in_(fake_emails))).delete()
        db.query(User).filter(User.email.in_(fake_emails)).delete()
        db.commit()

        # 2. Create 5 fake cases
        cases = [
            {
                "name": "Arjun Sharma",
                "email": "fake1@example.com",
                "age": 45,
                "gender": "male",
                "region": "Delhi",
                "symptoms": "Severe lower back pain for the last 3 months, radiating down the right leg.",
                "vitals": {"BP": "130/85", "Heart Rate": "72 bpm", "Weight": "82 kg"},
                "medical_history": "Mild hypertension, no history of diabetes. Previous episode of sciatica in 2018.",
                "current_medications": ["Ibuprofen 400mg (as needed)", "Amlodipine 5mg"],
                "investigations": "MRI Lumbar Spine (Aug 2026): L4-L5 disc bulge compressing right L5 nerve root.",
            },
            {
                "name": "Priya Patel",
                "email": "fake2@example.com",
                "age": 32,
                "gender": "female",
                "region": "Gujarat",
                "symptoms": "Chronic bloating, acid reflux, and constipation. Feeling sluggish all day.",
                "vitals": {"BP": "110/70", "Heart Rate": "68 bpm", "Weight": "58 kg"},
                "medical_history": "Diagnosed with IBS 2 years ago. Lactose intolerant.",
                "current_medications": ["Omeprazole 20mg", "Probiotics"],
                "investigations": "Endoscopy (Jan 2026): Mild gastritis. Stool test: Normal.",
            },
            {
                "name": "Ramesh Gupta",
                "email": "fake3@example.com",
                "age": 58,
                "gender": "male",
                "region": "Maharashtra",
                "symptoms": "Blurry vision, frequent headaches, and joint stiffness in the morning.",
                "vitals": {"BP": "145/90", "Heart Rate": "78 bpm", "Weight": "76 kg", "Blood Sugar (F)": "140 mg/dL"},
                "medical_history": "Type 2 Diabetes (5 years), Osteoarthritis in knees.",
                "current_medications": ["Metformin 500mg twice daily", "Glimepiride 1mg"],
                "investigations": "HbA1c (July 2026): 7.2%. Eye Exam: Early stage diabetic retinopathy.",
            },
            {
                "name": "Anita Desai",
                "email": "fake4@example.com",
                "age": 28,
                "gender": "female",
                "region": "Karnataka",
                "symptoms": "Severe anxiety, trouble sleeping, and occasional palpitations.",
                "vitals": {"BP": "115/75", "Heart Rate": "88 bpm", "Weight": "52 kg"},
                "medical_history": "No major chronic illnesses. Highly stressful job.",
                "current_medications": ["Melatonin 3mg (occasionally)"],
                "investigations": "Thyroid Profile (TSH, T3, T4): Normal. ECG: Normal sinus rhythm.",
            },
            {
                "name": "Vikram Singh",
                "email": "fake5@example.com",
                "age": 50,
                "gender": "male",
                "region": "Punjab",
                "symptoms": "High cholesterol, fatigue, and shortness of breath after climbing stairs.",
                "vitals": {"BP": "135/85", "Heart Rate": "76 bpm", "Weight": "89 kg", "BMI": "28.5"},
                "medical_history": "Family history of heart disease. Sedentary lifestyle.",
                "current_medications": ["Atorvastatin 10mg"],
                "investigations": "Lipid Profile: Total Cholesterol 240, LDL 160, HDL 40, Triglycerides 180.",
            }
        ]

        now = datetime.now(timezone.utc)

        for i, c in enumerate(cases):
            # Create user
            user = User(
                id=uuid.uuid4(),
                name=c["name"],
                email=c["email"],
                age=c["age"],
                phone_number=f"987654321{i}",
                city=c["region"],
                hashed_password="fakehash"
            )
            db.add(user)
            db.flush()

            # Create profile
            profile = PatientProfile(
                id=uuid.uuid4(),
                user_id=user.id,
                age=c["age"],
                gender=c["gender"],
                region=c["region"],
                occupation="Professional"
            )
            db.add(profile)
            db.flush()

            # Create conversation history to simulate intake
            conv_history = [
                {"role": "user", "content": c["symptoms"]},
                {"role": "agent", "content": "I understand. How long have you been experiencing this, and is there anything else I should know?"},
                {"role": "user", "content": "It's been going on for a while. " + c["medical_history"]}
            ]

            # Create consultation session
            session = ConsultationSession(
                id=uuid.uuid4(),
                patient_id=profile.id,
                user_id=user.id,
                session_data=conv_history,
                status="pending_review",
                vitals=c["vitals"],
                medical_history=c["medical_history"],
                current_medications=c["current_medications"],
                investigations=c["investigations"],
                created_at=now - timedelta(minutes=10*(5-i)) # Stagger creation times slightly
            )
            db.add(session)

        db.commit()
        print("Successfully cleared old cases and generated 5 fake pending cases!")

    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
