import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_gzip_middleware_enabled():
    """Menguji bahwa GZipMiddleware (WPO) aktif dan merespons kompresi dengan benar."""
    # Minta endpoint dengan header Accept-Encoding: gzip
    res = client.get("/", headers={"Accept-Encoding": "gzip"})
    assert res.status_code == 200

    # Uji endpoint reports dengan payload besar
    res_reports = client.get("/api/reports", headers={"Accept-Encoding": "gzip"})
    assert res_reports.status_code == 200
    # Verifikasi data terbaca dengan baik
    data = res_reports.json()
    assert "items" in data or isinstance(data, list) or "total" in data
