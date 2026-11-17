import io
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_root_endpoint():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["app"] == "PotholeScan API"
    assert data["status"] == "online"

def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"

def test_nearby_endpoint():
    res = client.get("/api/nearby?lat=-6.20876&lon=106.84559&radius_m=500")
    assert res.status_code == 200
    data = res.json()
    assert "unresolved_damages_count" in data
    assert data["radius_meters"] == 500

def test_auth_login_invalid():
    res = client.post("/api/auth/login", json={"username": "admin", "password": "wrong_password"})
    assert res.status_code == 401

def test_auth_login_success():
    res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["role"] == "admin"
    assert "access_token" in data

def test_upload_invalid_file_rejected():
    fake_exe_bytes = b"MZ\x90\x00\x03\x00\x00\x00"
    files = {"file": ("malicious.exe", io.BytesIO(fake_exe_bytes), "application/x-msdownload")}
    res = client.post("/api/reports", files=files)
    assert res.status_code == 422
    assert "JPEG/PNG" in res.json()["detail"]

def test_list_reports_endpoint():
    res = client.get("/api/reports")
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)
    for it in data["items"]:
        assert "image_url" in it
        assert "annotated_image_url" in it

def test_supabase_upload_image_url_format():
    from backend.app.services.supabase_client import SupabaseService
    from backend.app.core.config import settings
    svc = SupabaseService.get_instance()
    # Test path generation logic
    fake_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF"
    url = svc.upload_image(fake_bytes, folder="original", extension="jpg")
    assert url.startswith("https://")
    assert settings.SUPABASE_STORAGE_BUCKET in url
    assert "original/" in url
