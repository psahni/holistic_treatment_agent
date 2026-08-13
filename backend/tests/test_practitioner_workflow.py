import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
import sys
import os
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from config import get_settings
from database.models import get_db, User, ConsultationSession, PatientProfile

client = TestClient(app)

def test_treatment_mode_requires_login():
    """Verify that starting a session in Treatment Mode anonymously raises a 401."""
    session_id = str(uuid.uuid4())
    resp = client.post(
        "/api/naturo/start",
        json={
            "session_id": session_id,
            "message": "Start intake",
            "mode": "treatment",
            "patient_info": {"age": 28, "gender": "male", "region": "India", "occupation": "Software Engineer"}
        }
    )
    assert resp.status_code == 401
    assert "logged in" in resp.json()["detail"].lower()


def test_treatment_mode_workflow_e2e():
    """Test full practitioner review pipeline: signup -> start treatment -> submit intake -> review queue -> approve case -> email simulation."""
    # 1. Signup a test user
    test_email = f"patient_{uuid.uuid4().hex[:6]}@example.com"
    signup_resp = client.post(
        "/api/auth/signup",
        json={
            "name": "Test Patient",
            "age": 32,
            "email": test_email,
            "phone_number": f"+919876{uuid.uuid4().hex[:6]}",
            "city": "Mumbai",
            "password": "securepassword123"
        }
    )
    assert signup_resp.status_code in (200, 201)
    
    session_id = str(uuid.uuid4())
    
    # 2. Start treatment session (now logged in)
    start_resp = client.post(
        "/api/naturo/start",
        json={
            "session_id": session_id,
            "message": "I want a full plan",
            "mode": "treatment",
            "patient_info": {"age": 32, "gender": "male", "region": "India", "occupation": "Manager"}
        }
    )
    assert start_resp.status_code == 200
    
    # 3. Submit intake details
    intake_payload = {
        "session_id": session_id,
        "user_responses": {
            "response_1": "Severe Hashimoto thyroiditis with chronic fatigue",
            "response_2": "5 years",
            "response_3": "8",
            "response_4": "Hashimoto thyroiditis",
            "response_5": "Levothyroxine 75mcg",
            "response_6": "Vegetarian",
            "response_7": "High stress",
            "response_8": "No allergies"
        }
    }
    submit_resp = client.post("/api/naturo/submit_intake", json=intake_payload)
    assert submit_resp.status_code == 200
    final_data = submit_resp.json()
    assert final_data["is_complete"]
    assert "practitioner for review" in final_data["message"].lower()
    
    # 4. Log in as Administrator to inspect the queue
    settings = get_settings()
    admin_login_resp = client.post(
        "/api/admin/login",
        json={
            "username": settings.ADMIN_USERNAME,
            "password": settings.ADMIN_PASSWORD
        }
    )
    assert admin_login_resp.status_code == 200
    
    # 5. Check pending review cases queue
    pending_resp = client.get("/api/admin/pending-cases")
    assert pending_resp.status_code == 200
    pending_cases = pending_resp.json()["cases"]
    assert any(c["session_id"] == session_id for c in pending_cases)
    
    # 6. Fetch case details
    details_resp = client.get(f"/api/admin/cases/{session_id}")
    assert details_resp.status_code == 200
    details = details_resp.json()
    assert details["patient_name"] == "Test Patient"
    assert details["status"] == "pending_review"
    assert details.get("case_id") is not None
    
    # 7. Approve case and submit practitioner prescription
    approve_resp = client.post(
        f"/api/admin/cases/{session_id}/approve",
        json={
            "prescription_text": "APPROVED: Steamed vegetables and 30 minutes outdoor walking daily.",
            "safety_precautions": "Avoid heavy lifting.",
            "doctor_notes": "Follow up in 2 weeks."
        }
    )
    assert approve_resp.status_code == 200
    assert "reviewed and prescription submitted" in approve_resp.json()["message"].lower()
    
    # 8. Check that the case is no longer in the pending queue
    pending_resp2 = client.get("/api/admin/pending-cases")
    assert pending_resp2.status_code == 200
    pending_cases2 = pending_resp2.json()["cases"]
    assert not any(c["session_id"] == session_id for c in pending_cases2)
    
    # 9. Check that email was saved locally (mailer.py fallback)
    email_dir = os.path.join("data", "emails")
    assert os.path.exists(email_dir)
    files = os.listdir(email_dir)
    assert any(test_email in f for f in files)
    
    # 10. Verify that patient can retrieve their case history and case details by case_id
    history_resp = client.get("/api/naturo/history")
    assert history_resp.status_code == 200
    history_data = history_resp.json()["cases"]
    assert len(history_data) >= 1
    case = next((c for c in history_data if c["session_id"] == session_id), None)
    assert case is not None
    case_id = case["case_id"]
    assert case_id is not None
    
    # Fetch detailed case by case_id
    case_details_resp = client.get(f"/api/naturo/cases/{case_id}")
    assert case_details_resp.status_code == 200
    case_details = case_details_resp.json()
    assert case_details["case_id"] == case_id
    assert case_details["status"] == "reviewed"
    assert "APPROVED: Steamed vegetables" in case_details["doctor_prescription"]["prescription_text"]
