import pytest
import os
import sys

# Ensure backend dir is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Enforce local sqlite test database during tests
os.environ["DATABASE_URL"] = "sqlite:///./test_db.sqlite"

from config import get_settings
get_settings.cache_clear()

from database.models import Base, engine, init_db

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create database tables before all tests and drop them after."""
    Base.metadata.create_all(bind=engine)
    init_db()  # Seed templates etc
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(autouse=True)
def mock_vertex_llm(monkeypatch):
    """Automatically mock LLM unless REAL_LLM=true is specified."""
    if os.getenv("REAL_LLM", "").lower() == "true":
        yield
        return

    from tests.mock_llm import MockChatVertexAI
    import naturopathy.nodes
    mock_instance = MockChatVertexAI()
    monkeypatch.setattr(naturopathy.nodes, "get_llm", lambda: mock_instance)
    yield

@pytest.fixture(autouse=True)
def mock_retriever(monkeypatch):
    """Automatically mock hybrid retrieval in tests unless REAL_LLM=true."""
    if os.getenv("REAL_LLM", "").lower() == "true":
        yield
        return

    import naturopathy.nodes
    monkeypatch.setattr(
        naturopathy.nodes,
        "retrieve_hybrid_context",
        lambda query, k=3: {
            "context_text": "Authentic Naturopathic Reference: Hydration, plant-based nutrition, hydrotherapy, and routine sleep.",
            "sources": ["naturopathy_reference.pdf"]
        }
    )
    yield

