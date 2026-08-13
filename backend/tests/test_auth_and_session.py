import pytest
from fastapi.testclient import TestClient
import sys
import os
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app

client = TestClient(app)

def test_auth_workflow():
    unique_email = f"user.{int(time.time()*1000)}@example.com"
    signup_data = {
        "name": "Auth Test User",
        "email": unique_email,
        "password": "Password123!",
        "age": 28,
        "city": "Bengaluru",
        "phone_number": f"+91{int(time.time())}"
    }

    # 1. Signup
    signup_resp = client.post("/api/auth/signup", json=signup_data)
    assert signup_resp.status_code == 200
    assert signup_resp.json()["user"]["email"] == unique_email

    # 2. Duplicate Signup should fail
    dup_resp = client.post("/api/auth/signup", json=signup_data)
    assert dup_resp.status_code == 400

    # 3. Get Me (cookie is set)
    me_resp = client.get("/api/auth/me")
    assert me_resp.status_code == 200
    assert me_resp.json()["user"]["email"] == unique_email

    # 4. Logout
    logout_resp = client.post("/api/auth/logout")
    assert logout_resp.status_code == 200

    # 5. Login with login_id
    login_resp = client.post("/api/auth/login", json={
        "login_id": unique_email,
        "password": "Password123!"
    })
    assert login_resp.status_code == 200
    assert login_resp.json()["user"]["email"] == unique_email


def test_invalid_login():
    resp = client.post("/api/auth/login", json={
        "login_id": "nonexistent@example.com",
        "password": "WrongPassword!"
    })
    assert resp.status_code == 401


def test_unauthenticated_me():
    c = TestClient(app)
    resp = c.get("/api/auth/me")
    assert resp.status_code == 401


def test_get_session_not_found():
    resp = client.get("/api/session/nonexistent-session-id-999")
    assert resp.status_code == 404
