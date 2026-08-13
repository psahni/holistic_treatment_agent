import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from main import app
from database.models import get_db, ConsultationSession, User
from auth.utils import create_access_token

client = TestClient(app)

def test_delete_case(setup_database):
    # 1. Create user and session
    response = client.post("/api/auth/signup", json={
        "name": "Test User",
        "age": 30,
        "email": "test_delete@example.com",
        "phone_number": "1234567890",
        "city": "NY",
        "password": "password"
    })
    
    # login
    response = client.post("/api/auth/login", json={
        "login_id": "test_delete@example.com",
        "password": "password"
    })
    token = response.cookies.get("access_token")
    cookies = {"access_token": token}
    
    # 2. Get me to verify
    me = client.get("/api/auth/me", cookies=cookies)
    user_id = me.json()["id"]
    
    # 3. Create a consultation session
    # We can do this by submitting intake
    start_res = client.post("/api/naturo/start", json={
        "query": "I have a headache",
        "mode": "question"
    })
    session_id = start_res.json()["session_id"]
    
    submit_res = client.post("/api/naturo/submit_intake", json={
        "session_id": session_id,
        "user_responses": {"response_1": "test"}
    }, cookies=cookies)

    
    assert submit_res.status_code == 200
    
    # 4. Get history
    hist = client.get("/api/naturo/history", cookies=cookies)
    assert hist.status_code == 200
    cases = hist.json()["cases"]
    assert len(cases) > 0
    case_id = cases[0]["case_id"]
    
    # 5. Delete case
    del_res = client.delete(f"/api/naturo/cases/{case_id}", cookies=cookies)
    print("DELETE RESPONSE:", del_res.json())
    assert del_res.status_code == 200
