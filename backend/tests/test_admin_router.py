import pytest
from fastapi.testclient import TestClient
import sys
import os

# Ensure backend root is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from config import get_settings

client = TestClient(app)

@pytest.fixture
def override_admin_credentials():
    settings = get_settings()
    original_user = settings.ADMIN_USERNAME
    original_pass = settings.ADMIN_PASSWORD
    
    settings.ADMIN_USERNAME = "testadmin"
    settings.ADMIN_PASSWORD = "testpassword"
    
    yield settings
    
    settings.ADMIN_USERNAME = original_user
    settings.ADMIN_PASSWORD = original_pass


def test_login_success(override_admin_credentials):
    response = client.post(
        "/api/admin/login",
        json={"username": "testadmin", "password": "testpassword"}
    )
    assert response.status_code == 200
    assert response.json() == {"message": "Login successful"}
    
    # Check if HttpOnly cookie was set
    cookies = response.cookies
    assert "admin_token" in cookies
    # Note: TestClient cookies object doesn't easily expose HttpOnly flags, 
    # but we can verify the token exists.


def test_login_failure(override_admin_credentials):
    response = client.post(
        "/api/admin/login",
        json={"username": "wronguser", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert "Invalid credentials" in response.json()["detail"]


def test_check_auth_no_token():
    # Clearing cookies explicitly
    client.cookies.clear()
    response = client.get("/api/admin/check-auth")
    assert response.status_code == 401
    assert "Not authenticated" in response.json()["detail"]


def test_check_auth_with_token(override_admin_credentials):
    # 1. Login to get cookie
    login_resp = client.post(
        "/api/admin/login",
        json={"username": "testadmin", "password": "testpassword"}
    )
    assert login_resp.status_code == 200
    
    # 2. Check auth
    auth_resp = client.get("/api/admin/check-auth")
    assert auth_resp.status_code == 200
    assert auth_resp.json() == {"authenticated": True, "user": "testadmin"}


def test_logout(override_admin_credentials):
    # Login first
    client.post(
        "/api/admin/login",
        json={"username": "testadmin", "password": "testpassword"}
    )
    
    # Verify cookie exists
    assert "admin_token" in client.cookies
    
    # Logout
    logout_resp = client.post("/api/admin/logout")
    assert logout_resp.status_code == 200
    assert logout_resp.json() == {"message": "Logged out"}
    
    # Check auth fails now
    auth_resp = client.get("/api/admin/check-auth")
    assert auth_resp.status_code == 401
