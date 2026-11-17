# PotholeScan Backend (FastAPI + YOLOv8 + Supabase Cloud GIS)

Sistem backend inferensi AI deteksi kerusakan jalan (pothole & crack), kalkulasi keparahan 2-jalur, geospasial PostGIS, dan integrasi Supabase Cloud.

---

## 1. Setup Virtual Environment & Dependensi

Buka terminal PowerShell di folder root proyek:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependensi
pip install --upgrade pip
pip install -r requirements.txt
```

### Rekomendasi Khusus GPU NVIDIA GeForce RTX 4050 (CUDA)

Untuk memastikan PyTorch memanfaatkan GPU RTX 4050 secara maksimal, pasang PyTorch CUDA:

```powershell
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

---

## 2. Konfigurasi Supabase Cloud

1. Buka dashboard proyek Anda di [Supabase](https://supabase.com).
2. Masuk ke menu **SQL Editor**, buka file `backend/scripts/setup_database.sql`, lalu salin dan eksekusi kueri tersebut untuk mengaktifkan PostGIS, membuat tabel, trigger koordinat, dan kebijakan RLS.
3. Salin file `.env.example` menjadi `.env`:
   ```powershell
   cp .env.example .env
   ```
4. Isi `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` sesuai project settings API di Supabase.

---

## 3. Menjalankan Server Backend API

Pastikan virtual environment aktif:

```powershell
uvicorn app.main:app --reload --port 8000
```

- Dokumentasi Interaktif Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## 4. Pipeline Dataset & Pelatihan Model Lokal (GPU RTX 4050)

_Catatan: Seluruh dataset pelatihan HANYA disimpan di komputer lokal Anda dan TIDAK PERNAH dikirim ke Supabase._

### Langkah A: Unduh Dataset Kaggle (Otomatis)

```powershell
python scripts/download_kaggle_dataset.py
```

### Langkah B: Pemrosesan Label & Partisi Data (70/20/10)

```powershell
python scripts/prepare_dataset.py
```

### Langkah C: Pelatihan YOLOv8 Lokal dengan Akselerasi CUDA

```powershell
python scripts/train_local.py
```

Model terbaik otomatis tersimpan ke `backend/weights/best.pt`.

### Langkah D: Evaluasi Metrik & Benchmark Latensi

```powershell
python scripts/evaluate_model.py
```

---

## 5. Menjalankan Unit & Integration Test

```powershell
pytest tests/ -v
```
