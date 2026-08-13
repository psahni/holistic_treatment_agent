import pytest
from fastapi.testclient import TestClient
import sys
import os
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app

client = TestClient(app)

@pytest.fixture
def auth_client():
    c = TestClient(app)
    email = f"intake.patient.{int(time.time()*1000)}@example.com"
    user_payload = {
        "name": "Test Intake Patient",
        "email": email,
        "password": "Password123!",
        "age": 32,
        "city": "Mumbai",
        "phone_number": f"+91{int(time.time())}"
    }
    signup_resp = c.post("/api/auth/signup", json=user_payload)
    assert signup_resp.status_code == 200
    return c


def test_start_session(auth_client):
    start_payload = {
        "message": "Start health session",
        "patient_info": {"age": 35, "gender": "female", "region": "India", "occupation": "Engineer"},
        "session_id": None,
        "mode": "treatment"
    }
    resp = auth_client.post("/api/naturo/start", json=start_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "session_id" in data
    assert "message" in data


def test_submit_intake_direct_save(auth_client):
    # 1. Start session
    start_resp = auth_client.post("/api/naturo/start", json={
        "message": "Start session for intake test",
        "patient_info": {"age": 45, "gender": "male", "region": "Delhi"},
        "mode": "treatment"
    })
    session_id = start_resp.json()["session_id"]

    # 2. Submit intake
    intake_payload = {
        "session_id": session_id,
        "user_responses": {
            "response_1": "Chronic digestive issues and bloating",
            "response_2": "2 years",
            "response_3": "7",
            "response_4": "IBS diagnosis",
            "response_5": "None",
            "response_6": "Vegetarian",
            "response_7": "Sedentary",
            "response_8": "No allergies"
        }
    }
    submit_resp = auth_client.post("/api/naturo/submit_intake", json=intake_payload)
    assert submit_resp.status_code == 200
    data = submit_resp.json()
    assert data["step"] == "complete"
    assert "details have been sent" in data["message"]

    # 3. Check history
    history_resp = auth_client.get("/api/naturo/history")
    assert history_resp.status_code == 200
    cases = history_resp.json().get("cases", [])
    assert len(cases) >= 1
    found_case = next((c for c in cases if c["session_id"] == session_id), None)
    assert found_case is not None
    assert found_case["status"] == "pending_review"

    # 4. Check patient case details endpoint
    case_id = found_case["case_id"]
    detail_resp = auth_client.get(f"/api/naturo/cases/{case_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["case_id"] == case_id
