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

def test_delete_user_requires_admin():
    # 1. Pastikan client tidak memiliki sesi aktif (logout)
    client.post("/api/auth/logout")
    # 2. Permintaan tanpa autentikasi wajib ditolak dengan 401
    res = client.delete("/api/auth/users/2")
    assert res.status_code in [401, 403]

def test_admin_delete_staff_flow():
    # 1. Login as admin
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Admin cannot delete self (ID 1)
    del_self = client.delete("/api/auth/users/1", headers=headers, cookies={"access_token": token})
    assert del_self.status_code == 400

    # 3. Create a temporary staff to delete
    create_res = client.post(
        "/api/auth/users",
        headers=headers,
        cookies={"access_token": token},
        json={
            "username": "temp_petugas",
            "password": "password123",
            "full_name": "Petugas Sementara",
            "role": "petugas"
        }
    )
    assert create_res.status_code == 200
    temp_id = create_res.json()["id"]

    # 4. Admin deletes temporary staff
    del_res = client.delete(f"/api/auth/users/{temp_id}", headers=headers, cookies={"access_token": token})
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True
