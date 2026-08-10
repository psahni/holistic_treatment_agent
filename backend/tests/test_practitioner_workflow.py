import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
import sys
import os
import uuid
from langchain_core.messages import AIMessage

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from config import get_settings
from database.models import get_db, User, ConsultationSession, PatientProfile

client = TestClient(app)

@pytest.fixture(autouse=True)
def cleanup_db():
    yield
    # No complex cleanup required as SQLite runs locally and test cases use unique keys.

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
    """Test full practitioner review pipeline: signup -> start treatment -> complete intake -> review queue -> approve case -> email simulation."""
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
    assert signup_resp.status_code == 201
    # TestClient automatically maintains cookies, so we are now logged in!
    
    # Mock LLM to simulate Treatment Mode completion
    mock_llm = MagicMock()
    
    def mock_invoke(messages, *args, **kwargs):
        system_prompt = messages[0].content
        if "ROOT_CAUSE_PROMPT" in system_prompt or "Analyze all collected" in system_prompt:
            return AIMessage(content='[{"cause": "Stress", "category": "Emotional", "severity": "moderate", "reasoning": "high work hours"}]')
        elif "PROTOCOL_SELECTION_PROMPT" in system_prompt or "Select Nature Cure" in system_prompt:
            return AIMessage(content='[{"type": "lifestyle_changes", "name": "Deep breathing", "description": "Pranayama", "duration": "7 days", "frequency": "daily"}]')
        elif "RECOMMENDATION_PROMPT" in system_prompt or "Synthesize" in system_prompt:
            return AIMessage(content='''{
                "root_causes": [{"cause": "Stress", "category": "Emotional", "severity": "moderate", "reasoning": "high work hours"}],
                "protocols": [{"type": "lifestyle_changes", "name": "Deep breathing", "description": "Pranayama", "duration": "7 days", "frequency": "daily"}],
                "daily_routine": "Wake up 6 AM, Pranayama 20m",
                "diet_guidelines": {"recommended_foods": ["Greens", "Sprouts"], "foods_to_avoid": ["Sugar", "Coffee"]},
                "red_flags": ["Chest pain"],
                "follow_up_timeline": "7 days",
                "disclaimer": "AYUSH Disclaimer"
            }''')
        else:
            return AIMessage(content="[MODE: treatment] Tell me about your lifestyle.")
            
    mock_llm.invoke.side_effect = mock_invoke
    
    session_id = str(uuid.uuid4())
    
    with patch("naturopathy.nodes.get_llm", return_value=mock_llm):
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
        data = start_resp.json()
        assert data["step"] == "intake"
        assert not data["is_complete"]
        
        # Send 6 more chat messages (to collect 7 responses)
        for i in range(1, 7):
            chat_resp = client.post(
                "/api/naturo/chat",
                json={
                    "session_id": session_id,
                    "message": f"Answer details {i}"
                }
            )
            assert chat_resp.status_code == 200
            assert chat_resp.json()["step"] == "intake"
            assert not chat_resp.json()["is_complete"]
            
        # Send the 8th message to complete intake and save to SQL DB
        final_resp = client.post(
            "/api/naturo/chat",
            json={
                "session_id": session_id,
                "message": "Final lifestyle response 8"
            }
        )
        assert final_resp.status_code == 200
        final_data = final_resp.json()
        assert final_data["is_complete"]
        assert "practitioner for review" in final_data["message"].lower()
        
        # 3. Log in as Administrator to inspect the queue
        settings = get_settings()
        admin_login_resp = client.post(
            "/api/admin/login",
            json={
                "username": settings.ADMIN_USERNAME,
                "password": settings.ADMIN_PASSWORD
            }
        )
        assert admin_login_resp.status_code == 200
        
        # 4. Check pending review cases queue
        pending_resp = client.get("/api/admin/pending-cases")
        assert pending_resp.status_code == 200
        pending_cases = pending_resp.json()["cases"]
        assert any(c["session_id"] == session_id for c in pending_cases)
        
        # 5. Fetch case details
        details_resp = client.get(f"/api/admin/cases/{session_id}")
        assert details_resp.status_code == 200
        details = details_resp.json()
        assert details["patient_name"] == "Test Patient"
        assert details["status"] == "pending_review"
        
        # 6. Approve case and submit practitioner prescription
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
        
        # 7. Check that the case is no longer in the pending queue
        pending_resp2 = client.get("/api/admin/pending-cases")
        assert pending_resp2.status_code == 200
        pending_cases2 = pending_resp2.json()["cases"]
        assert not any(c["session_id"] == session_id for c in pending_cases2)
        
        # 8. Check that email was saved locally (mailer.py fallback)
        email_dir = os.path.join("data", "emails")
        assert os.path.exists(email_dir)
        files = os.listdir(email_dir)
        assert any(test_email in f for f in files)
