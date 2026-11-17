import io
import pytest
import openpyxl
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def get_auth_token():
    res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    return res.json()["access_token"]

def test_export_unauthorized_rejected():
    res_excel = client.get("/api/reports/export/excel")
    assert res_excel.status_code == 401

    res_pdf = client.get("/api/reports/pdf")
    assert res_pdf.status_code == 401

def test_export_excel_endpoint():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/reports/export/excel", headers=headers)
    assert res.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in res.headers["content-type"]
    assert "rekap-kerusakan-jalan" in res.headers["content-disposition"]

    # Validasi sintaks berkas Excel dengan openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(res.content))
    ws = wb.active
    assert ws.title == "Rekapitulasi Kerusakan"

    # Validasi Kop Dinas Resmi PUPR
    assert ws["A1"].value == "DINAS PEKERJAAN UMUM DAN PENATAAN RUANG (PUPR)"
    assert ws["A2"].value == "REKAPITULASI RESMI TATA KELOLA PENANGANAN KERUSAKAN JALAN (POTHOLESCAN)"
    assert "Dicetak pada:" in str(ws["A3"].value)

    # Validasi Header Tabel (Row 5)
    expected_headers = [
        "No", "ID Laporan", "Tanggal Lapor", "Koordinat GPS",
        "Sumber Lokasi", "Tingkat Keparahan", "Keyakinan AI", "Status Penanganan", "Tautan Foto Anotasi"
    ]
    for col_idx, expected in enumerate(expected_headers, 1):
        assert ws.cell(row=5, column=col_idx).value == expected

    # Data row check (jika database memiliki laporan)
    assert ws.max_row >= 5

def test_export_excel_with_filters():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}
    # Test filter status ALL
    res = client.get("/api/reports/export/excel?status=ALL&from_date=2020-01-01&to_date=2099-12-31", headers=headers)
    assert res.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(res.content))
    ws = wb.active
    assert ws["A1"].value == "DINAS PEKERJAAN UMUM DAN PENATAAN RUANG (PUPR)"

def test_export_pdf_endpoint():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/reports/pdf", headers=headers)
    assert res.status_code == 200
    assert "application/pdf" in res.headers["content-type"]
    assert res.content.startswith(b"%PDF-")
    assert len(res.content) > 1000

def test_export_pdf_with_filters():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/reports/pdf?status=ALL&from_date=2020-01-01&to_date=2099-12-31", headers=headers)
    assert res.status_code == 200
    assert res.content.startswith(b"%PDF-")

def test_export_with_query_token():
    token = get_auth_token()
    res_excel = client.get(f"/api/reports/export/excel?token={token}")
    assert res_excel.status_code == 200

    res_pdf = client.get(f"/api/reports/pdf?token={token}")
    assert res_pdf.status_code == 200

