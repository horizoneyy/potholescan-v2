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

def test_settings_get_and_update():
    # 1. Get settings (publik)
    res = client.get("/api/settings")
    assert res.status_code == 200
    data = res.json()
    assert "confidence_threshold_min" in data
    assert "confidence_threshold_publish" in data
    assert "proximity_radius_meters" in data

    # 2. Login admin
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # 3. Patch ambang batas dengan token admin
    patch_res = client.patch(
        "/api/settings",
        json={"confidence_threshold_min": 0.25, "confidence_threshold_publish": 0.65, "proximity_radius_meters": 500},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["success"] is True
    assert updated["confidence_threshold_min"] == 0.25
    assert updated["confidence_threshold_publish"] == 0.65
    assert updated["proximity_radius_meters"] == 500

def test_staff_accounts_login():
    for user, pwd in [("daniel", "petugas123"), ("niyel", "petugas123")]:
        res = client.post("/api/auth/login", json={"username": user, "password": pwd})
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["role"] == "petugas"

def test_create_and_delete_user():
    import uuid
    test_uname = f"uji_{uuid.uuid4().hex[:6]}"
    # Login admin
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # Buat user baru
    create_res = client.post(
        "/api/auth/users",
        json={
            "username": test_uname,
            "password": "password123",
            "full_name": "Petugas Uji Coba",
            "role": "petugas"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert create_res.status_code == 200
    new_user = create_res.json()
    assert new_user["username"] == test_uname
    user_id = new_user["id"]

    # Hapus user
    del_res = client.delete(
        f"/api/auth/users/{user_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True
