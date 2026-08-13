import pytest
import os
import sys

# Ensure backend dir is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.models import Base, engine, init_db

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create database tables before all tests and drop them after."""
    Base.metadata.create_all(bind=engine)
    init_db()  # Seed templates etc
    yield
    Base.metadata.drop_all(bind=engine)
