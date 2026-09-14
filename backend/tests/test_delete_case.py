import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from main import app
from database.models import get_db, ConsultationSession, User
from auth.utils import create_access_token

client = TestClient(app)

import uuid
import time

def test_delete_case(setup_database):
    test_client = TestClient(app)
    unique_id = uuid.uuid4().hex[:6]
    test_email = f"test_delete_{unique_id}@example.com"
    test_phone = f"+919{int(time.time()) % 1000000000:09d}"

    # 1. Create user and login
    signup_resp = test_client.post("/api/auth/signup", json={
        "name": "Test User",
        "age": 30,
        "email": test_email,
        "phone_number": test_phone,
        "city": "NY",
        "password": "password"
    })
    assert signup_resp.status_code in (200, 201)
    
    login_resp = test_client.post("/api/auth/login", json={
        "login_id": test_email,
        "password": "password"
    })
    assert login_resp.status_code == 200
    
    # 2. Verify authentication
    me = test_client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == test_email
    
    # 3. Create a consultation session & submit intake
    start_res = test_client.post("/api/naturo/start", json={
        "message": "I have a headache",
        "mode": "question"
    })
    assert start_res.status_code == 200
    session_id = start_res.json()["session_id"]
    
    submit_res = test_client.post("/api/naturo/submit_intake", json={
        "session_id": session_id,
        "user_responses": {"response_1": "test headache"}
    })
    assert submit_res.status_code == 200
    
    # 4. Get history
    hist = test_client.get("/api/naturo/history")
    assert hist.status_code == 200
    cases = hist.json()["cases"]
    assert len(cases) > 0
    case_id = cases[0]["case_id"]
    
    # 5. Delete case
    del_res = test_client.delete(f"/api/naturo/cases/{case_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"
