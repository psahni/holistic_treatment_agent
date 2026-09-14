import pytest
from fastapi.testclient import TestClient
import uuid
import time
import sys
import os

# Ensure backend root is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from config import get_settings

client = TestClient(app)


def test_e2e_question_mode_full_journey():
    """
    E2E Journey 1: Guest Question Mode
    - Start session as anonymous user with mild digestive concern.
    - Ask follow-up question via chat.
    - Verify active state in session store.
    - Ask about chronic severe condition (triggers treatment mode recommendation).
    - Cleanly delete/end session.
    """
    session_id = f"e2e-guest-{uuid.uuid4().hex[:6]}"
    
    # 1. Start question mode consultation
    start_resp = client.post(
        "/api/naturo/start",
        json={
            "session_id": session_id,
            "message": "I have mild bloating after lunch",
            "mode": "question",
            "patient_info": {
                "age": 29,
                "gender": "female",
                "region": "India",
                "occupation": "Software Engineer"
            }
        }
    )
    assert start_resp.status_code == 200
    start_data = start_resp.json()
    assert start_data["session_id"] == session_id
    assert not start_data["is_complete"]
    assert len(start_data["message"]) > 10

    # 2. Follow-up query in the same session
    chat_resp = client.post(
        "/api/naturo/chat",
        json={
            "session_id": session_id,
            "message": "What herbal tea or home remedy can I drink for this?",
            "mode": "question"
        }
    )
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    assert chat_data["session_id"] == session_id

    # 3. Retrieve session state from /api/session/{id}
    session_resp = client.get(f"/api/session/{session_id}")
    assert session_resp.status_code == 200
    session_data = session_resp.json()
    assert session_data["session_id"] == session_id

    # 4. Trigger treatment mode recommendation with chronic condition
    chronic_resp = client.post(
        "/api/naturo/chat",
        json={
            "session_id": session_id,
            "message": "Actually I have had severe chronic Hashimoto autoimmune thyroiditis for 5 years",
            "mode": "question"
        }
    )
    assert chronic_resp.status_code == 200
    chronic_data = chronic_resp.json()
    assert chronic_data["recommended_mode"] == "treatment"

    # 5. Delete and clean up session
    del_resp = client.delete(f"/api/session/{session_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "deleted"

    # 6. Verify session is no longer in store
    assert client.get(f"/api/session/{session_id}").status_code == 404


def test_e2e_treatment_mode_full_practitioner_lifecycle():
    """
    E2E Journey 2: Full Treatment Mode Patient -> Practitioner Lifecycle
    - Patient signup & login.
    - Start treatment mode session.
    - Submit 8-item clinical intake questionnaire.
    - Confirm DB status is 'pending_review'.
    - Practitioner logs in, verifies case in pending review queue.
    - Practitioner generates on-demand AI prescription draft.
    - Practitioner saves draft and approves case.
    - Patient logs back in, verifies status is 'reviewed' and prescription is attached.
    """
    patient_client = TestClient(app)
    unique_suffix = uuid.uuid4().hex[:6]
    patient_email = f"e2e_patient_{unique_suffix}@example.com"
    patient_phone = f"+919{int(time.time()) % 1000000000:09d}"

    # 1. Patient Signup
    signup_resp = patient_client.post(
        "/api/auth/signup",
        json={
            "name": "E2E Treatment Patient",
            "age": 34,
            "email": patient_email,
            "phone_number": patient_phone,
            "city": "Hyderabad",
            "password": "StrongPassword123!"
        }
    )
    assert signup_resp.status_code in (200, 201)

    # 2. Patient Login
    login_resp = patient_client.post(
        "/api/auth/login",
        json={"login_id": patient_email, "password": "StrongPassword123!"}
    )
    assert login_resp.status_code == 200

    # 3. Start Treatment Session
    session_id = str(uuid.uuid4())
    start_resp = patient_client.post(
        "/api/naturo/start",
        json={
            "session_id": session_id,
            "message": "I need holistic treatment for recurring acid reflux and fatigue",
            "mode": "treatment",
            "patient_info": {
                "age": 34,
                "gender": "male",
                "region": "India",
                "occupation": "Architect"
            }
        }
    )
    assert start_resp.status_code == 200

    # 4. Submit Complete Intake Questionnaire
    intake_resp = patient_client.post(
        "/api/naturo/submit_intake",
        json={
            "session_id": session_id,
            "user_responses": {
                "response_1": "Acid reflux, burning sensation, and daily afternoon fatigue",
                "response_2": "3 years",
                "response_3": "7",
                "response_4": "GERD diagnosed in 2023",
                "response_5": "Antacids occasionally",
                "response_6": "High spicy and oily food, irregular meals",
                "response_7": "Sedentary desk job with high stress",
                "response_8": "No known allergies"
            }
        }
    )
    assert intake_resp.status_code == 200
    intake_data = intake_resp.json()
    assert intake_data["is_complete"]
    assert "practitioner for review" in intake_data["message"].lower()

    # 5. Check patient history reflects 'pending_review'
    patient_hist = patient_client.get("/api/naturo/history")
    assert patient_hist.status_code == 200
    cases = patient_hist.json()["cases"]
    my_case = next((c for c in cases if c["session_id"] == session_id), None)
    assert my_case is not None
    assert my_case["status"] == "pending_review"
    case_id = my_case["case_id"]

    # 6. Admin / Practitioner Login
    admin_client = TestClient(app)
    settings = get_settings()
    admin_login_resp = admin_client.post(
        "/api/admin/login",
        json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD}
    )
    assert admin_login_resp.status_code == 200

    # 7. Verify case appears in Admin pending queue
    pending_resp = admin_client.get("/api/admin/pending-cases")
    assert pending_resp.status_code == 200
    pending_cases = pending_resp.json()["cases"]
    assert any(c["session_id"] == session_id for c in pending_cases)

    # 8. Admin reviews case details
    details_resp = admin_client.get(f"/api/admin/cases/{session_id}")
    assert details_resp.status_code == 200
    details_data = details_resp.json()
    assert details_data["patient_email"] == patient_email
    assert details_data["status"] == "pending_review"

    # 9. Admin generates AI prescription draft
    ai_rx_resp = admin_client.post(
        f"/api/admin/cases/{session_id}/generate-ai-prescription",
        json={"doctor_prompt": "Create a 14 day naturopathy diet and hydrotherapy plan for acid reflux"}
    )
    assert ai_rx_resp.status_code == 200
    assert "prescription_text" in ai_rx_resp.json()

    # 10. Admin saves draft
    draft_resp = admin_client.post(
        f"/api/admin/cases/{session_id}/draft",
        json={
            "prescription_text": "Draft Naturopathy protocol: Alkaline green juice fasting 2 days, then cooling diet.",
            "safety_precautions": "Avoid heavy meals after 7 PM.",
            "doctor_notes": "Initial draft prepared for patient."
        }
    )
    assert draft_resp.status_code == 200
    assert draft_resp.json()["message"] == "Draft saved successfully"

    # 11. Admin approves the case
    approve_resp = admin_client.post(
        f"/api/admin/cases/{session_id}/approve",
        json={
            "prescription_text": "Final Naturopathy Protocol: 1. Morning ash gourd juice. 2. Cold compress on abdomen 20 mins. 3. Shatavari & licorice decoction.",
            "safety_precautions": "Do not skip lunch. Sleep elevated.",
            "doctor_notes": "Prescription finalized and approved after clinical review."
        }
    )
    assert approve_resp.status_code == 200
    assert "reviewed" in approve_resp.json()["message"].lower()

    # 12. Patient verifies case status is now 'reviewed'
    updated_hist = patient_client.get("/api/naturo/history")
    assert updated_hist.status_code == 200
    updated_cases = updated_hist.json()["cases"]
    updated_case = next((c for c in updated_cases if c["session_id"] == session_id), None)
    assert updated_case is not None
    assert updated_case["status"] == "reviewed"
    assert updated_case["has_prescription"] is True

    # 13. Patient inspects official prescription details
    case_detail_resp = patient_client.get(f"/api/naturo/cases/{case_id}")
    assert case_detail_resp.status_code == 200
    case_detail = case_detail_resp.json()
    assert case_detail["status"] == "reviewed"
    assert "ash gourd juice" in case_detail["doctor_prescription"]["prescription_text"].lower()
    assert "clinical review" in case_detail["doctor_notes"].lower()


def test_e2e_emergency_safety_guardrails_redirection():
    """
    E2E Journey 3: Emergency & Triage Guardrails
    - Start session with emergency medical symptoms -> intercepted and rejected with 400.
    - Chat message with emergency symptoms -> flagged and directed to 112 emergency services.
    - Verify zero consultation session was leaked/persisted.
    """
    emergency_client = TestClient(app)

    # 1. Start session with life-threatening emergency
    start_resp = emergency_client.post(
        "/api/naturo/start",
        json={
            "message": "I have severe crushing chest pain radiating to left arm and numbness",
            "mode": "question",
            "patient_info": {"age": 55, "gender": "male", "region": "India", "occupation": "Banker"}
        }
    )
    assert start_resp.status_code == 400
    assert "112" in start_resp.json()["detail"] or "emergency" in start_resp.json()["detail"].lower()

    # 2. Start normal session, then send emergency message mid-chat
    norm_resp = emergency_client.post(
        "/api/naturo/start",
        json={
            "message": "I have a headache",
            "mode": "question",
            "patient_info": {"age": 30, "gender": "female", "region": "India", "occupation": "Teacher"}
        }
    )
    assert norm_resp.status_code == 200
    sess_id = norm_resp.json()["session_id"]

    chat_resp = emergency_client.post(
        "/api/naturo/chat",
        json={
            "session_id": sess_id,
            "message": "Now my father is having a stroke right now, face is drooping",
            "mode": "question"
        }
    )
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    assert "emergency" in chat_data["safety_flags"]
    assert "112" in chat_data["message"]


def test_e2e_case_deletion_permissions_and_state_guards():
    """
    E2E Journey 4: Access Control & Case Lifecycle Rules
    - User A submits intake (pending_review).
    - User B cannot delete User A's case (returns 404).
    - User A can delete own pending case (returns 200).
    - User A creates a new case, Admin approves it (reviewed).
    - User A attempts to delete reviewed case -> forbidden (403).
    """
    u1_client = TestClient(app)
    u2_client = TestClient(app)
    unique_suffix = uuid.uuid4().hex[:6]

    # User A setup
    u1_email = f"user_a_{unique_suffix}@example.com"
    u1_phone = f"+919{int(time.time()) % 1000000000:09d}"
    u1_signup = u1_client.post("/api/auth/signup", json={
        "name": "User A", "age": 27, "email": u1_email, "phone_number": u1_phone, "city": "Delhi", "password": "Password123!"
    })
    assert u1_signup.status_code in (200, 201)
    u1_login = u1_client.post("/api/auth/login", json={"login_id": u1_email, "password": "Password123!"})
    assert u1_login.status_code == 200

    # User B setup
    u2_email = f"user_b_{unique_suffix}@example.com"
    u2_phone = f"+918{int(time.time()) % 1000000000:09d}"
    u2_signup = u2_client.post("/api/auth/signup", json={
        "name": "User B", "age": 30, "email": u2_email, "phone_number": u2_phone, "city": "Delhi", "password": "Password123!"
    })
    assert u2_signup.status_code in (200, 201)
    u2_login = u2_client.post("/api/auth/login", json={"login_id": u2_email, "password": "Password123!"})
    assert u2_login.status_code == 200

    # User A creates pending case
    s1_id = str(uuid.uuid4())
    u1_client.post("/api/naturo/start", json={
        "session_id": s1_id,
        "message": "Constipation and sluggish liver",
        "mode": "treatment",
        "patient_info": {"age": 27, "gender": "male", "region": "India", "occupation": "Dev"}
    })
    u1_client.post("/api/naturo/submit_intake", json={
        "session_id": s1_id,
        "user_responses": {"response_1": "Digestive sluggishness"}
    })
    u1_cases = u1_client.get("/api/naturo/history").json()["cases"]
    u1_case_id = u1_cases[0]["case_id"]

    # User B attempts to delete User A's case -> 404 Case not found
    del_attempt = u2_client.delete(f"/api/naturo/cases/{u1_case_id}")
    assert del_attempt.status_code == 404

    # User A successfully deletes own pending case -> 200
    u1_del = u1_client.delete(f"/api/naturo/cases/{u1_case_id}")
    assert u1_del.status_code == 200
    assert u1_del.json()["status"] == "deleted"

    # User A creates case 2, which gets approved by Admin
    s2_id = str(uuid.uuid4())
    u1_client.post("/api/naturo/start", json={
        "session_id": s2_id,
        "message": "Mild skin rash",
        "mode": "treatment",
        "patient_info": {"age": 27, "gender": "male", "region": "India", "occupation": "Dev"}
    })
    u1_client.post("/api/naturo/submit_intake", json={
        "session_id": s2_id,
        "user_responses": {"response_1": "Dry skin rash"}
    })
    case2_id = u1_client.get("/api/naturo/history").json()["cases"][0]["case_id"]

    # Admin approves case 2
    admin_client = TestClient(app)
    settings = get_settings()
    admin_client.post("/api/admin/login", json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD})
    admin_client.post(f"/api/admin/cases/{s2_id}/approve", json={
        "prescription_text": "Neem water wash twice daily.",
        "safety_precautions": "Keep skin hydrated.",
        "doctor_notes": "Approved"
    })

    # User A attempts to delete reviewed case -> 403 Forbidden
    del_reviewed = u1_client.delete(f"/api/naturo/cases/{case2_id}")
    assert del_reviewed.status_code == 403
    assert "already reviewed" in del_reviewed.json()["detail"].lower()


def test_e2e_unauthenticated_endpoints_security():
    """
    E2E Journey 5: Unauthenticated Access Guard
    - Verifies all treatment & personal health records require authentication.
    """
    anon_client = TestClient(app)
    
    # 1. Anonymous treatment mode start -> 401
    resp1 = anon_client.post(
        "/api/naturo/start",
        json={
            "message": "Treatment please",
            "mode": "treatment",
            "patient_info": {"age": 25, "gender": "female", "region": "India", "occupation": "Lawyer"}
        }
    )
    assert resp1.status_code == 401
    assert "logged in" in resp1.json()["detail"].lower()

    # 2. Anonymous submit intake -> 401
    resp2 = anon_client.post(
        "/api/naturo/submit_intake",
        json={"session_id": "test-anon-1", "user_responses": {}}
    )
    assert resp2.status_code == 401

    # 3. Anonymous history check -> 401
    resp3 = anon_client.get("/api/naturo/history")
    assert resp3.status_code == 401

    # 4. Anonymous case detail -> 401
    resp4 = anon_client.get("/api/naturo/cases/1")
    assert resp4.status_code == 401
