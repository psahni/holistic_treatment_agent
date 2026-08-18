import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from config import get_settings

client = TestClient(app)

@pytest.fixture
def admin_client():
    # Login to get the cookie
    settings = get_settings()
    client.post(
        "/api/admin/login",
        json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD}
    )
    return client

def test_generate_ai_prescription_validation(admin_client):
    session_id = "test-session-123"
    
    # Test rejection: Too short
    resp = admin_client.post(
        f"/api/admin/cases/{session_id}/generate-ai-prescription",
        json={"doctor_prompt": "hi"}
    )
    assert resp.status_code == 400
    assert "valid clinical prompt is required" in resp.json()["detail"]
    
    # Test rejection: Missing keywords
    resp = admin_client.post(
        f"/api/admin/cases/{session_id}/generate-ai-prescription",
        json={"doctor_prompt": "Please help this person out with something nice."}
    )
    assert resp.status_code == 400
    assert "Prompt does not appear to be clinically relevant" in resp.json()["detail"]

    # Test success path for validation (mocking the actual generation if needed, but we expect 404 session not found here since test DB doesn't have it)
    # The validation happens before session lookup!
    resp = admin_client.post(
        f"/api/admin/cases/{session_id}/generate-ai-prescription",
        json={"doctor_prompt": "Generate a 5 day plan for gut health"}
    )
    # It should pass keyword validation ('generate', 'plan', 'health', 'day') and then hit 404 because session_id doesn't exist
    assert resp.status_code == 404
    assert "Session not found" in resp.json()["detail"]
