import os
import sys
import pytest

# Ensure backend root is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from config import get_settings

# Set environment immediately at import time (before test collection and skipif evaluation)
os.environ["APP_ENV"] = "test"
_settings = get_settings()
if _settings.GEMINI_API_KEY and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = _settings.GEMINI_API_KEY

@pytest.fixture(scope="session", autouse=True)
def setup_eval_environment():
    """Ensures test environment remains active throughout the pytest session."""
    os.environ["APP_ENV"] = "test"
    yield
