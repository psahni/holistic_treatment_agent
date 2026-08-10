import pytest
from fastapi.testclient import TestClient
import sys
import os
import time

# Ensure backend root is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from config import get_settings

client = TestClient(app)

@pytest.fixture(autouse=True)
def ensure_cache_enabled():
    settings = get_settings()
    original_cache = settings.CACHE_LLM
    settings.CACHE_LLM = True
    yield
    settings.CACHE_LLM = original_cache


def test_meta_query_greeting():
    """Verify that greeting or simple meta phrases trigger polite introductions, not medical advice."""
    session_id = "test-session-greet"
    
    # 1. Start session
    start_resp = client.post(
        "/api/naturo/start",
        json={
            "session_id": session_id,
            "message": "hello there",
            "mode": "question",
            "patient_info": {"age": 25, "gender": "male", "region": "India", "occupation": "Engineer"}
        }
    )
    assert start_resp.status_code == 200
    data = start_resp.json()
    assert data["session_id"] == session_id
    assert "remed" not in data["message"].lower()  # Should not give remedies on simple greet
    assert data["recommended_mode"] is None


def test_short_simple_query():
    """Verify that simple, minor health questions return question mode recommendations."""
    session_id = "test-session-simple"
    
    # Start session with simple query
    resp = client.post(
        "/api/naturo/start",
        json={
            "session_id": session_id,
            "message": "what is a natural remedy for occasional hiccups?",
            "mode": "question",
            "patient_info": {"age": 30, "gender": "female", "region": "India", "occupation": "Engineer"}
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert any(x in data["message"].lower() for x in ["hiccup", "water", "breath", "naturopathy", "holistic", "symptom", "remedy"])
    # Hiccups are minor, so recommended mode should be question or None
    assert data["recommended_mode"] in ["question", None]


def test_vague_query_clarification():
    """Verify that vague inputs ('I feel sick', 'pain') prompt for clarification instead of guessing remedies."""
    session_id = "test-session-vague"
    
    resp = client.post(
        "/api/naturo/start",
        json={
            "session_id": session_id,
            "message": "I am feeling sick and have pain",
            "mode": "question",
            "patient_info": {"age": 40, "gender": "male", "region": "India", "occupation": "Engineer"}
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    # It should ask clarifying questions about what they feel or where the pain is
    msg_lower = data["message"].lower()
    assert any(x in msg_lower for x in ["clarify", "where", "what", "symptom", "describe", "detail", "tell me more"])


def test_severe_chronic_query_treatment_recommendation():
    """Verify that severe, complex, or chronic conditions recommend switching to Full Treatment Mode."""
    session_id = "test-session-chronic"
    
    resp = client.post(
        "/api/naturo/start",
        json={
            "session_id": session_id,
            "message": "I have been suffering from autoimmune Hashimoto's thyroiditis and chronic fatigue for the last 5 years.",
            "mode": "question",
            "patient_info": {"age": 35, "gender": "female", "region": "India", "occupation": "Engineer"}
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    # Should suggest switching to treatment mode
    assert data["recommended_mode"] == "treatment"
    assert "treatment" in data["message"].lower()


def test_llm_caching_performance():
    """Verify that identical queries run significantly faster due to the cache layer."""
    session_id_1 = "test-session-cache-1"
    session_id_2 = "test-session-cache-2"
    query = "Natural cure for mild sunburn?"
    
    # Step 1: Run query 1 (Cache miss, triggers Vertex AI call)
    t0 = time.time()
    resp1 = client.post(
        "/api/naturo/start",
        json={
            "session_id": session_id_1,
            "message": query,
            "mode": "question",
            "patient_info": {"age": 28, "gender": "male", "region": "India", "occupation": "Engineer"}
        }
    )
    t1 = time.time()
    latency_1 = t1 - t0
    assert resp1.status_code == 200
    print(f"First request latency: {latency_1:.2f}s")
    
    # Step 2: Run identical query (Cache hit, should return immediately)
    t2 = time.time()
    resp2 = client.post(
        "/api/naturo/start",
        json={
            "session_id": session_id_2,
            "message": query,
            "mode": "question",
            "patient_info": {"age": 28, "gender": "male", "region": "India", "occupation": "Engineer"}
        }
    )
    t3 = time.time()
    latency_2 = t3 - t2
    assert resp2.status_code == 200
    print(f"Second request (cached) latency: {latency_2:.2f}s")
    
    # Assert cached response matches and is significantly faster (usually <100ms)
    assert resp2.json()["message"] == resp1.json()["message"]
    assert latency_2 < 0.2  # Assert it took less than 200ms
    assert latency_2 < (latency_1 * 0.1)  # Or at least 10x faster
