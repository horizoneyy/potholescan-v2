# Tech Stack PotholeScan

**Scope:** Fondasi teknis MVP PotholeScan — Platform Deteksi Kerusakan & Lubang Jalan Berbasis Deep Learning & Supabase Cloud GIS

**Rujukan produk:** [PRD](PRD.md), [SRS](SRS.md), [HDD](HDD.md), dan [METODOLOGI](METODOLOGI.md)

Dokumen ini menetapkan standar arsitektur dan teknologi yang digunakan untuk pengembangan sistem PotholeScan. Keputusan stack dirancang untuk memberikan kinerja inferensi AI yang native di sisi backend Python, dipadukan dengan keandalan basis data relasional dan penyimpanan media terkelola di **Supabase Cloud**.

---

## Pilihan yang Ditetapkan

| Area | Teknologi | Pemakaian |
| --- | --- | --- |
| **Backend API & AI Engine** | FastAPI (Python 3.11+) + Uvicorn | RESTful API berkinerja tinggi, asynchronous event-loop, serta integrasi runtime langsung dengan model AI tanpa overhead IPC/jaringan tambahan |
| **Model Deteksi Objek** | Ultralytics YOLOv8 (PyTorch) | Inferensi deteksi objek kerusakan jalan untuk kelas `pothole` dan `crack` dengan ukuran input $640 \times 640$ |
| **Pengolahan Citra** | OpenCV-Python (`cv2`) + Pillow (PIL) | Preprocessing citra, letterbox resize, penggambaran *bounding box* anotasi, dan validasi biner |
| **Ekstraksi Geospasial** | ExifRead + HTML5 Geolocation API | Parsing metadata GPS dari tag EXIF citra; fallback ke API geolokasi peramban dan penempatan pin manual |
| **Database Cloud** | Supabase PostgreSQL + PostGIS | Penyimpanan data laporan, deteksi kotak, riwayat status, pengaturan, dan audit log; ekstensi PostGIS diaktifkan untuk kalkulasi geospasial presisi |
| **Media & Object Storage** | Supabase Storage (S3-Compatible) | Penyimpanan berkas foto asli dan foto beranotasi hasil deteksi pada bucket terisolasi (`potholescan-media`) |
| **Akses Data Backend** | SQLAlchemy 2.0 (Async) / `asyncpg` + `supabase-py` | Akses basis data PostgreSQL bertipe (*type-safe*), transaksi atomik, dan interaksi SDK Supabase Storage |
| **Migrasi Database** | Alembic / Supabase CLI | Version-controlled database migrations untuk tabel, constraint, indeks spasial, dan kebijakan RLS |
| **Autentikasi & Sesi** | JWT (`python-jose`) + Passlib (Argon2id) | Autentikasi akun Petugas Dinas dan Admin dengan sesi berbasis token terenkripsi via HTTP-only Cookie aman |
| **Otorisasi Data** | Server-side role check + PostgreSQL Row Level Security (RLS) | Proteksi data laporan internal dan pembatasan visibilitas laporan di level baris basis data |
| **Frontend Web** | React 18+ + Vite + TypeScript strict | Single Page Application (SPA) publik dan dashboard dinas dengan performa render cepat dan tipe data ketat |
| **Peta & GIS Web** | Leaflet + React-Leaflet + OpenStreetMap | Visualisasi peta interaktif, ubin OSM bebas lisensi, penanda warna tingkat keparahan, dan klasterisasi titik |
| **Styling & UI Components** | Tailwind CSS v4 + Lucide React | Desain antarmuka modern responsif dengan sistem token warna konsisten dan ikonografi terstandar |
| **Validasi Skema** | Pydantic v2 (Backend) + Zod (Frontend) | Validasi payload request/response server dan validasi form di sisi klien |
| **Pelaporan Dokumen** | ReportLab / WeasyPrint (Python) | Kompilasi otomatis laporan rekapitulasi penanganan kerusakan jalan format PDF resmi dinas |
| **Rate Limiting** | SlowAPI (Token Bucket Algorithm) | Proteksi endpoint unggah publik `/api/reports` dari spam berkas dan serangan DoS |
| **Testing** | Pytest + HTTPX (Backend); Vitest (Frontend) | Pengujian logika inferensi, kalkulasi keparahan, endpoint API, dan komponen frontend |
| **Dependency Management** | `requirements.txt` / Poetry (Python) + `package-lock.json` (Node.js) | Reproduksibilitas pustaka dependensi antar lingkungan pengembang |

---

## Batas Arsitektur

### Backend, AI Engine, dan Supabase

- **Siklus Hidup Model AI (Singleton):** Model YOLOv8 di-*load* ke memori server tepat **satu kali** pada saat inisialisasi aplikasi FastAPI (*startup lifespan*), dan referensi objek model dipakai berulang kali untuk melayani request inferensi tanpa *re-instantiation*.
- **Pemisahan Logika Inferensi dan Penyimpanan Cloud:**
  1. Frontend mengirim berkas citra ke endpoint FastAPI `/api/reports`.
  2. FastAPI memvalidasi keaslian berkas (*magic bytes*) dan mengeksekusi deteksi YOLOv8 secara lokal di server.
  3. Setelah deteksi selesai dan keparahan terhitung, FastAPI mengunggah berkas citra asli dan citra beranotasi ke **Supabase Storage** via API Service Role.
  4. URL publik citra dari Supabase Storage beserta koordinat (Latitude, Longitude) dan daftar kotak deteksi dicatat ke dalam **Supabase PostgreSQL**.
- **Kalkulasi Geospasial Spasial:**
  - Dengan tersedianya PostgreSQL PostGIS di Supabase, query radius proksimitas $500\text{ meter}$ dapat memanfaatkan indeks spasial GiST dan fungsi `ST_DWithin` / `ST_DistanceSphere` yang memiliki performa jauh lebih efisien dibanding kalkulasi manual iteratif.
- **Kredensial Layanan (Service Role vs Anon Key):**
  - Kunci `SUPABASE_SERVICE_ROLE_KEY` (hak istimewa bypass RLS) disimpan secara rahasia di file `.env` server backend FastAPI dan **tidak pernah terekspos ke frontend/peramban**.
  - Klien web publik hanya berkomunikasi melalui gerbang backend FastAPI atau menggunakan `SUPABASE_ANON_KEY` dengan batasan RLS ketat.

### Media & Storage

- Berkas foto tidak disimpan sebagai biner mentah di dalam database PostgreSQL untuk mencegah lonjakan ukuran database (*table bloating*).
- Seluruh citra diunggah ke bucket Supabase Storage:
  - `potholescan-media/original/YYYY/MM/UUID.jpg`
  - `potholescan-media/annotated/YYYY/MM/UUID_annotated.jpg`
- Laporan yang berstatus `BARU`, `DIVERIFIKASI`, dan `SELESAI` dapat diakses melalui URL publik CDN Supabase Storage. Laporan yang berstatus `DISEMBUNYIKAN` (*false positive*) dicabut hak tayang publiknya melalui konfigurasi visibilitas di layer API.

### Keamanan & Akses Kontrol

- Pengendara publik tidak memerlukan akun dan tidak memiliki token.
- Petugas dan Admin diverifikasi menggunakan kredensial terenkripsi (hash Argon2id). Sesi diamankan dengan token JWT yang memiliki batas masa kedaluwarsa (*access token expiry* 8 jam).
- Endpoint yang melakukan mutasi status penanganan dan administrasi akun memverifikasi peran (*role check*) pada setiap request.

---

## Status dan Hal yang Belum Ditetapkan

1. **Paket Layanan Supabase:** Untuk fase MVP, digunakan tier **Supabase Free Tier** (500 MB database, 1 GB storage, 2 GB transfer) yang sangat mencukupi untuk fase pengujian dan demonstrasi akademik.
2. **Akselerasi GPU Khusus:** Inferensi dikonfigurasi fleksibel: otomatis memakai GPU CUDA jika terdeteksi, atau beralih ke komputasi CPU 4-core multi-threaded jika dijalankan pada VPS standar.
3. **Penyensoran Wajah & Plat Nomor Otomatis:** Fitur pengaburan visual otomatis (*blurring*) dicatat sebagai *future enhancement* pasca-MVP.
4. **Notifikasi WhatsApp / Email Dinas:** Pengiriman notifikasi pesan instan ke ponsel petugas lapangan belum diaktifkan pada cakupan MVP; pemantauan dilakukan terpusat melalui dashboard dinas.

---

## Referensi Implementasi

- [Dokumentasi Resmi FastAPI](https://fastapi.tiangolo.com/)
- [Panduan Ultralytics YOLOv8](https://docs.ultralytics.com/)
- [Supabase Python Client (`supabase-py`)](https://supabase.com/docs/reference/python/introduction)
- [PostgreSQL PostGIS di Supabase](https://supabase.com/docs/guides/database/extensions/postgis)
- [Supabase Storage Management](https://supabase.com/docs/guides/storage)
- [Leaflet.js Interactive Maps](https://leafletjs.com/reference.html)
- [ReportLab PDF Generation Python](https://www.reportlab.com/docs/reportlab-userguide.pdf)
