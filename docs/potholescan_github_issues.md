# PotholeScan - Spesifikasi Lengkap GitHub Issues

Dokumen ini memuat spesifikasi 6 GitHub Issues berstandar industri dengan format terstruktur (_PIC, Objective, Scope, Out of Scope, Acceptance Criteria, Suggested Branch, Definition of Done, Referensi_) sesuai template rekayasa perangkat lunak referensi.

---

## Ringkasan Pembagian Issues

| ID Issue            | Judul Issue                                                          | Cakupan / Modul                           | Branch yang Disarankan                |
| :------------------ | :------------------------------------------------------------------- | :---------------------------------------- | :------------------------------------ |
| **`[PS-FE-01]`**    | Refactor Public Map Overlay, GPS Gating & Clean UI                   | Frontend (`Public.tsx`, `MapView.tsx`)    | `feature/public-map-gps-cleanup`      |
| **`[PS-FE-02]`**    | Redesign Halaman Login: Hapus Akun Demo & Tambah Banner Ilustrasi    | Frontend (`Login.tsx`)                    | `feature/login-redesign-cleanup`      |
| **`[PS-AUTH-03]`**  | RBAC Refinement: Admin Read-Only Laporan & Manajemen Akun Staf       | Fullstack (`Admin.tsx`, `auth.py`, DB)    | `feature/rbac-admin-staff-management` |
| **`[PS-MEDIA-04]`** | Perbaikan Rendering Thumbnail Foto Laporan di Dashboard Staf & Admin | Fullstack (`Staff.tsx`, `Admin.tsx`, API) | `fix/thumbnail-media-rendering`       |
| **`[PS-EXP-05]`**   | Modernisasi Ekspor: Rekapitulasi PDF Riil & Generator Excel (.xlsx)  | Backend & UI (`pdf.py`, `excel.py`)       | `feature/excel-pdf-export-sync`       |
| **`[PS-DB-06]`**    | Sinkronisasi Penuh Database Supabase & Seeding Akun Resmi            | Database & Backend (`supabase_client.py`) | `feature/supabase-live-sync-seeding`  |

---

## 1. `[PS-FE-01]` Refactor Public Map Overlay, GPS Gating & Clean UI

### PIC

Andi Daniel — Frontend & Geolocation

### Objective

Merapikan antarmuka pelaporan publik, memastikan peta interaktif tidak tertutupi overlay kartu besar, mengunci posisi pelapor sesuai GPS (menonaktifkan pergeseran titik manual pada klik peta), menghapus teks/logo teknis, serta memberlakukan gating GPS sebelum kamera dapat digunakan.

### Scope

- **Map Overlay:**
  - Reposisi badge _"Peta Spasial GIS"_ dan ringkasan kerusakan di `src/components/Public.tsx` agar tidak menutupi canvas `MapView.tsx`.
  - Ubah teks dari `"0 lubang aktif"` menjadi `"0 lubang"` (hapus kata _"aktif"_).
- **GPS Lock:**
  - Nonaktifkan handler event `click` pemindah marker di `src/components/MapView.tsx` (posisi marker strictly mengacu pada `userLocation`).
- **UI Cleanup:**
  - Hapus badge `"Analisis AI (FastAPI + YOLOv8)"` beserta icon-nya di form pelaporan.
  - Hapus footer _"Foto diproses secara aman via FastAPI & Supabase Storage."_ beserta logonya di `src/components/Public.tsx`.
- **Camera & GPS Gating:**
  - Hapus tombol galeri `"Pilih foto"` (hanya kamera yang tersedia).
  - Tombol `"Buka kamera"` berstatus `disabled` jika koordinat GPS belum didapatkan atau belum akurat.
  - Tampilkan pesan informatif: _"Menunggu sinyal GPS untuk membuka kamera..."_.

### Out of Scope

- Halaman login dan dashboard staf/admin (ditangani di `[PS-FE-02]` & `[PS-AUTH-03]`).

### Acceptance Criteria

- Canvas peta Leaflet bersih dan tidak terhalang kotak kartu besar.
- Mengklik sembarang titik di peta tidak memindahkan marker pelapor.
- Teks menampilkan format `"X lubang"` (kata _"aktif"_ dihilangkan).
- Teks/badge teknologi FastAPI, YOLOv8, dan Supabase tidak tampil di halaman publik.
- Tombol _"Pilih foto"_ tidak ada lagi; tombol _"Buka kamera"_ terkunci (`disabled`) hingga izin lokasi GPS diperoleh.

### Suggested Branch

`feature/public-map-gps-cleanup`

### Definition of Done

- Komponen `Public.tsx` dan `MapView.tsx` lolos verifikasi browser tanpa runtime error.
- `npm run build` sukses 0 error.

### Referensi

- `docs/specifications/SRS.md` §3.1 (FR-01: Akuisisi Citra & Validasi Geospasial).
- `docs/specifications/PRD.md` §2.2 (Alur Pelaporan Publik).

---

## 2. `[PS-FE-02]` Redesign Halaman Login: Hapus Akun Demo & Tambah Banner Ilustrasi

### PIC

Andi Daniel — Frontend & UI/UX

### Objective

Menghapus tampilan kredensial akun demo dari antarmuka login publik dan menambahkan gambar ilustrasi tata kelola infrastruktur jalan modern di atas slogan dinas.

### Scope

- **Pembersihan Akun Demo:**
  - Hapus kartu `"Akun demo resmi (klik untuk mengisi)"` yang berisi username/password `admin` dan `petugas01` dari `src/components/Login.tsx`.
- **Banner Ilustrasi:**
  - Menambahkan gambar/ilustrasi visual tata kelola infrastruktur jalan di area kosong di atas teks _"Verifikasi, tangani, rekap."_ dengan styling responsif dan rapi.

### Out of Scope

- Logika verifikasi token JWT dan hashing password di backend (ditangani di `[PS-AUTH-03]`).

### Acceptance Criteria

- Halaman login tidak menampilkan bocoran kredensial demo sama sekali.
- Area kanan halaman login memiliki ilustrasi visual yang profesional, proporsional, dan estetik di atas slogan dinas.
- Tampilan responsif pada ukuran desktop dan mobile.

### Suggested Branch

`feature/login-redesign-cleanup`

### Definition of Done

- `src/components/Login.tsx` bersih dan `npm run build` sukses.

### Referensi

- `docs/specifications/SRS.md` §3.4 (FR-11: Autentikasi Pengguna & RBAC).

---

## 3. `[PS-AUTH-03]` RBAC Refinement: Admin Read-Only Laporan & Manajemen Akun Staf

### PIC

Andi Daniel — Backend & Fullstack RBAC

### Objective

Memperbarui identitas administrator menjadi Andi Daniel, menjadikan tabel semua laporan pada dashboard admin berstatus read-only (tanpa tombol ubah), serta memperbarui nama petugas (Daniel & Niyel) dan menyediakan fitur hapus petugas.

### Scope

- **Admin Identity:**
  - Profil akun admin resmi menampilkan nama `"Andi Daniel"`.
- **Admin Read-Only:**
  - Pada `src/components/Admin.tsx` di tabel "Semua Laporan", hilangkan kolom/tombol aksi "Ubah Status". Admin murni bertindak sebagai pengawas (_monitoring/audit_).
- **Staff Management:**
  - Ubah nama Petugas 1 menjadi `"Daniel"`, Petugas 2 menjadi `"Niyel"`.
- **Staff Deletion:**
  - Tambahkan ikon hapus petugas (merah) beserta fungsi `handleDeleteStaff` di `Admin.tsx` dan endpoint `DELETE /api/auth/users/{id}` di backend.

### Out of Scope

- Seeding database Supabase (dilakukan di `[PS-DB-06]`).

### Acceptance Criteria

- Login sebagai admin menampilkan nama "Andi Daniel".
- Tabel laporan di dashboard admin tidak memiliki tombol ubah status laporan.
- Tabel staf menampilkan Daniel dan Niyel dengan tombol aksi hapus yang fungsional.
- Petugas yang dihapus terhapus dari daftar dan database.

### Suggested Branch

`feature/rbac-admin-staff-management`

### Definition of Done

- Hak akses admin dan staf terisolasi dengan baik. Unit test auth di `backend/tests/test_api.py` lulus 100%.

### Referensi

- `docs/specifications/SRS.md` §3.4 (FR-12 & FR-13: Manajemen Pengguna & Tata Kelola Status).
- `docs/specifications/HDD.md` §4.2 (Role-Based Access Control).

---

## 4. `[PS-MEDIA-04]` Perbaikan Rendering Thumbnail Foto Laporan di Dashboard Staf & Admin

### PIC

Andi Daniel — Media & Storage Fullstack

### Objective

Mengatasi masalah gambar rusak (_broken image placeholder_) pada tabel daftar laporan masuk di halaman petugas dan admin, sehingga foto asli dan foto beranotasi bounding box tampil jelas.

### Scope

- **Image URL Resolution:**
  - Memastikan URL citra dari Supabase Storage (`potholescan-media/original/...` dan `potholescan-media/annotated/...`) berstatus publik dan termuat dengan benar pada tabel `src/components/Staff.tsx` dan `src/components/Admin.tsx`.
- **Error Handling & Fallback:**
  - Menambahkan atribut `onError` dengan gambar placeholder jalan berlubang default jika koneksi gambar lambat atau URL lama.
- **Image Preview Modal:**
  - Memastikan saat foto diklik, modal menampilkan foto beresolusi penuh beserta kotak deteksi AI.

### Out of Scope

- Pelatihan ulang model AI YOLOv8.

### Acceptance Criteria

- Kolom foto di tabel Staff dan Admin tidak menampilkan broken image icon.
- Foto laporan riil dari Supabase Storage tampil dengan aspect ratio rapi.
- Fallback placeholder muncul jika berkas foto tidak ditemukan di server.

### Suggested Branch

`fix/thumbnail-media-rendering`

### Definition of Done

- Verifikasi tampilan tabel di browser `http://localhost:5173` menunjukkan foto bukti termuat dengan sempurna.

### Referensi

- `docs/specifications/SRS.md` §3.2 (FR-07: Penyimpanan Media Cloud Supabase).
- `docs/specifications/HDD.md` §5 (Data Architecture & Media Lifecycle).

---

## 5. `[PS-EXP-05]` Modernisasi Ekspor: Rekapitulasi PDF Riil & Generator Excel (.xlsx)

### PIC

Andi Daniel — Backend Reporting & Data Export

### Objective

Mengubah tombol rekap menjadi "Rekap", mengganti format unduhan CSV mentah menjadi file Excel asli (`.xlsx`), serta memastikan isi data pada berkas PDF dan Excel 100% konsisten dan identik dengan data tabel sistem.

### Scope

- **UI Labeling:**
  - Mengubah label tombol di header menjadi `"Rekap"`, dan tombol ekspor menjadi `"Unduh Excel (.xlsx)"` pada `src/components/Staff.tsx`, `Admin.tsx`, dan `shared.tsx`.
- **Excel (.xlsx) Generator:**
  - Membuat endpoint `GET /api/reports/export/excel` menggunakan pustaka `openpyxl` yang menghasilkan spreadsheet Excel berformat resmi dinas (Header Dinas, Nomor Laporan, Tanggal, Koordinat GPS, Tingkat Keparahan, Status Penanganan).
- **PDF Data Sync:**
  - Memperbaiki generator PDF di `backend/app/services/pdf_generator.py` agar mengambil data riil dari Supabase, sehingga file PDF yang diunduh terisi lengkap dan tidak kosong.

### Out of Scope

- Pengubahan skema tabel utama database.

### Acceptance Criteria

- Tombol bertuliskan "Rekap" dan "Unduh Excel (.xlsx)".
- Mengunduh Excel menghasilkan berkas valid `.xlsx` yang dapat dibuka di Microsoft Excel.
- Berkas PDF yang diunduh memuat tabel laporan yang sama persis dengan yang ada di sistem.

### Suggested Branch

`feature/excel-pdf-export-sync`

### Definition of Done

- Uji unduh PDF dan Excel melalui browser menghasilkan file dengan data riil yang sinkron.

### Referensi

- `docs/specifications/SRS.md` §3.5 (FR-16: Ekspor Rekapitulasi Resmi PDF/Excel).

---

## 6. `[PS-DB-06]` Sinkronisasi Penuh Database Supabase & Seeding Akun Resmi

### PIC

Andi Daniel — Database & Cloud GIS

### Objective

Melakukan seeding data resmi ke tabel `users` di Supabase Cloud (Andi Daniel, Daniel, Niyel), mengeliminasi ketergantungan mock data statis di frontend (`src/data.ts`), dan menghubungkan seluruh statistik dashboard langsung ke PostGIS.

### Scope

- **User Seeding:**
  - Menulis dan menjalankan skrip seeding untuk tabel `users` di Supabase dengan hash password Argon2id:
    - `admin` (Role: `admin`, Nama: `Andi Daniel`)
    - `daniel` (Role: `petugas`, Nama: `Daniel`)
    - `niyel` (Role: `petugas`, Nama: `Niyel`)
- **Live Data Parity:**
  - Menghubungkan seluruh tab status (_Antrean, Aktif, Semua_) di frontend ke endpoint `/api/reports` yang bersumber langsung dari Supabase PostgreSQL.
- **Header Statistics Aggregation:**
  - Menghitung statistik _"Titik Aktif"_, _"Kategori Berat"_, dan _"Radius Waspada"_ langsung dari hasil kueri database Supabase, bukan data statis `src/data.ts`.

### Out of Scope

- Pengunggahan dataset Kaggle (dataset tetap 100% lokal di `backend/data/`).

### Acceptance Criteria

- Tabel `users` di dashboard Supabase terisi akun Andi Daniel, Daniel, dan Niyel.
- Frontend menampilkan data laporan riil dari database Supabase.
- Tidak ada disparitas antara data di web dengan data di Supabase Table Editor.

### Suggested Branch

`feature/supabase-live-sync-seeding`

### Definition of Done

- Kueri Supabase mengembalikan data yang sama dengan yang tampil di UI; seluruh 14 unit test backend lolos.

### Referensi

- `docs/specifications/SRS.md` §3.3 (FR-09 & FR-10: Database Spasial PostGIS).
- `docs/specifications/HDD.md` §5.1 (Relational & Spatial Schema).
