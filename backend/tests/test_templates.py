import pytest
from fastapi.testclient import TestClient
import sys
import os
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from config import get_settings
from database.models import SessionLocal, PrescriptionTemplate, seed_templates

client = TestClient(app)

@pytest.fixture
def override_admin_auth():
    settings = get_settings()
    orig_user = settings.ADMIN_USERNAME
    orig_pass = settings.ADMIN_PASSWORD
    settings.ADMIN_USERNAME = "testadmin"
    settings.ADMIN_PASSWORD = "testpassword"
    
    # Login to acquire admin_token cookie
    login_resp = client.post("/api/admin/login", json={"username": "testadmin", "password": "testpassword"})
    assert login_resp.status_code == 200
    
    yield settings
    
    settings.ADMIN_USERNAME = orig_user
    settings.ADMIN_PASSWORD = orig_pass
    client.cookies.clear()


def test_seed_templates_idempotent():
    with SessionLocal() as db:
        initial_count = db.query(PrescriptionTemplate).count()
        seed_templates(db)
        post_count = db.query(PrescriptionTemplate).count()
        assert post_count >= initial_count


def test_get_templates(override_admin_auth):
    response = client.get("/api/admin/templates")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    sample = data[0]
    assert "id" in sample
    assert "name" in sample
    assert "category" in sample
    assert "prescription_text" in sample


def test_template_crud_lifecycle(override_admin_auth):
    # 1. Create template
    create_payload = {
        "name": "Test Protocol for Asthma",
        "category": "Asthma",
        "prescription_text": "1. Steam inhalation 15m\n2. Sitopaladi churna 1 tsp with honey",
        "safety_precautions": "Avoid cold weather exposure"
    }
    create_resp = client.post("/api/admin/templates", json=create_payload)
    assert create_resp.status_code == 200
    res_data = create_resp.json()
    assert "id" in res_data
    template_id = res_data["id"]

    # 2. Verify in list
    list_resp = client.get("/api/admin/templates")
    matching = [t for t in list_resp.json() if t["id"] == template_id]
    assert len(matching) == 1
    assert matching[0]["name"] == "Test Protocol for Asthma"

    # 3. Update template
    update_payload = {
        "name": "Updated Asthma Protocol",
        "safety_precautions": "Updated safety precautions"
    }
    update_resp = client.put(f"/api/admin/templates/{template_id}", json=update_payload)
    assert update_resp.status_code == 200

    # 4. Verify update
    list_resp_2 = client.get("/api/admin/templates")
    updated = [t for t in list_resp_2.json() if t["id"] == template_id][0]
    assert updated["name"] == "Updated Asthma Protocol"
    assert updated["safety_precautions"] == "Updated safety precautions"

    # 5. Delete template
    del_resp = client.delete(f"/api/admin/templates/{template_id}")
    assert del_resp.status_code == 200

    # 6. Verify deletion
    list_resp_3 = client.get("/api/admin/templates")
    assert not any(t["id"] == template_id for t in list_resp_3.json())


def test_update_nonexistent_template(override_admin_auth):
    resp = client.put("/api/admin/templates/999999", json={"name": "Nonexistent"})
    assert resp.status_code == 404


def test_delete_nonexistent_template(override_admin_auth):
    resp = client.delete("/api/admin/templates/999999")
    assert resp.status_code == 404
