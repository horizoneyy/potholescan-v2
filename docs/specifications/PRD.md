# Product Requirements Document (PRD)

# PotholeScan: Platform Deteksi & Tata Kelola Kerusakan Jalan

**Document Version:** 1.0  
**Status:** Approved for Development  
**Product:** PotholeScan MVP Platform  
**Document Type:** Product Requirements Document  
**Primary Users:** Pengendara (Warga Publik), Petugas Lapangan PUPR, Administrator Dinas  
**Prepared For:** Tim Pengembang PotholeScan & Dinas Pekerjaan Umum

**Keputusan Teknis:** Stack implementasi telah disepakati dalam [TECH_STACK.md](TECH_STACK.md), mencakup backend FastAPI, inferensi Ultralytics YOLOv8, Supabase PostgreSQL + PostGIS, Supabase Storage, serta antarmuka React + Leaflet GIS.

---

## 1. Executive Summary

PotholeScan adalah platform sistem informasi berbasis web responsif yang mengintegrasikan kecerdasan buatan (_computer vision_) dan sistem informasi geografis (GIS) untuk mempercepat proses pelaporan, verifikasi, dan penanganan kerusakan permukaan jalan (khususnya lubang dan retak).

Sistem ini menjembatani partisipasi warga dengan operasional Dinas Pekerjaan Umum dan Penataan Ruang (PUPR) / Bina Marga. Warga dapat melaporkan jalan berlubang secara instan tanpa perlu mendaftar akun, sementara kecerdasan buatan (YOLOv8) secara otomatis mengevaluasi foto, menghitung tingkat keparahan secara matematis, mengekstrak koordinat GPS, dan menampilkannya pada peta sebaran interaktif.

Untuk menjamin kualitas data pada peta publik, sistem menerapkan mekanisme penyaringan visibilitas bertingkat (_Tiered Confidence Filtering_): deteksi dengan tingkat keyakinan tinggi ($\ge 0.65$) langsung dipublikasikan, sementara deteksi dengan keyakinan sedang ($0.25 - 0.64$) masuk ke antrean kurasi petugas lapangan untuk mencegah laporan keliru (_false positive_) membingungkan masyarakat.

---

## 2. Product Vision

Membangun satu ekosistem pelaporan dan tata kelola perbaikan jalan daerah yang:

1. Menjadi pusat data spasial resmi kondisi jalan rusak di wilayah perkotaan/kabupaten.
2. Memangkas rantai birokrasi pelaporan dari hari/minggu menjadi hitungan detik.
3. Menghilangkan subjektivitas penilaian kerusakan jalan melalui formulasi matematis berbasis computer vision.
4. Memberikan peringatan keselamatan dini (_proximity alert_) bagi pengendara di sekitar titik jalan berlubang.
5. Mempermudah petugas dinas memprioritaskan penambalan aspal berdasarkan tingkat keparahan (Ringan, Sedang, Berat) dan klaster wilayah.
6. Menyediakan otomasi pelaporan administratif dinas melalui rekapitulasi berkas format PDF resmi yang dapat dicetak kapan saja.

---

## 3. Problem Statement

### 3.1 Hambatan Survei Manual

Survei jalan visual konvensional memerlukan anggaran bahan bakar kendaraan dinas, waktu survei berhari-hari, serta rentan bahaya tertabrak bagi petugas yang memeriksa aspal secara manual.

### 3.2 Laporan Masyarakat Tanpa Koordinat Presisi

Pengaduan jalan rusak yang diunggah warga melalui media sosial sering kali tidak menyertakan koordinat lintang/bujur (_latitude/longitude_) yang akurat, menyulitkan armada tambal jalan menemukan titik kerusakan.

### 3.3 Bias Penilaian Tingkat Kerusakan

Tanpa standarisasi ukuran, klasifikasi lubang jalan sering kali bergantung pada estimasi kasar mata surveyor di lapangan.

### 3.4 Ketiadaan Sistem Rekapitulasi Terpusat

Riwayat penanganan jalan rusak sering tercecer di catatan pesan instan atau formulir kertas terpisah, menyulitkan pimpinan dinas melakukan evaluasi alokasi material aspal dingin (_cold mix_) maupun aspal panas (_hot mix_).

---

## 4. Product Goals

### 4.1 Primary Goals (Tujuan Utama)

- Menyediakan web portal publik yang memungkinkan warga mengunggah foto jalan tanpa login.
- Menjalankan deteksi AI otomatis untuk mengenali objek `pothole` (lubang) dan `crack` (retak) dalam waktu $\le 1.0\text{ detik}$.
- Menghitung rasio keparahan secara objektif (Ringan, Sedang, Berat).
- Mengekstrak koordinat lokasi secara otomatis (EXIF GPS / Geolokasi Peramban / Pin Manual Leaflet).
- Menyimpan foto asli dan foto beranotasi ke cloud **Supabase Storage**.
- Menyimpan rekaman laporan dan data koordinat ke **Supabase PostgreSQL** dengan ekstensi **PostGIS**.
- Menyediakan dashboard operasional bagi Petugas Dinas untuk memverifikasi dan memperbarui status penanganan jalan.
- Mengompilasi dan mengunduh laporan rekapitulasi resmi format PDF berfilter rentang tanggal.

### 4.2 Secondary Goals (Tujuan Pendukung)

- Memberikan peringatan dini proksimitas ($500\text{ meter}$) bagi warga jika berada dekat dengan titik kerusakan jalan aktif.
- Memastikan sistem dapat digunakan dengan nyaman pada perangkat smartphone (mobile-responsive).
- Mencegah spam berkas dan serangan DoS dengan penerapan _rate limiting_ yang ketat.

---

## 5. Non-Goals (Batasan Di Luar Cakupan MVP)

Untuk menjaga penyelesaian MVP tetap realistis dan terfokus, fitur-fitur berikut **tidak** termasuk dalam cakupan versi awal:

- Aplikasi native khusus Android/iOS (sistem beroperasi via Mobile Web Browser).
- Pemrosesan video streaming real-time dari kamera dashcam terus-menerus.
- Segmentasi semantik poligon tingkat lanjut (digantikan oleh _bounding box_ terkalibrasi).
- Fitur sensor getaran jalan menggunakan giroskop/akselerometer smartphone.
- Pengaburan otomatis wajah dan plat nomor kendaraan secara AI (dicatat sebagai batasan privasi).
- Integrasi pembayaran atau pengadaan lelang material perbaikan aspal.

---

## 6. Product Scope & Domains

Sistem PotholeScan terbagi menjadi 3 domain utama:

```text
POTHOLESCAN PLATFORM

1. PUBLIC PORTAL (Warga / Pengendara)
   ├── Halaman Peta Publik (OpenStreetMap + Leaflet)
   ├── Formulir Unggah Cepat (Kamera / Galeri)
   ├── Penentu Lokasi (EXIF / GPS / Pin Geser)
   └── Peringatan Proksimitas Radius 500 Meter

2. AI INFERENCE & SEVERITY ENGINE
   ├── Model YOLOv8 (Pothole & Crack Detection)
   ├── Formulasi Keparahan Deterministik
   └── Filter Keyakinan Bertingkat (Tiered Confidence)

3. STAFF & ADMIN MANAGEMENT (Dinas PUPR)
   ├── Autentikasi Sesi Petugas & Administrator
   ├── Dashboard Kurasi Laporan (Pending Review)
   ├── Siklus Status Penanganan (Baru -> Selesai)
   ├── Moderasi Laporan Keliru (Hide False Positive)
   ├── Unduh Laporan Rekapitulasi Berkas PDF
   └── Manajemen Akun Petugas & Ambang Deteksi
```

---

## 7. System Actors (Aktor Sistem)

### 7.1 Pengendara / Warga (Public User)

Pengguna publik yang mengakses aplikasi melalui web browser ponsel atau desktop.

- Tidak memiliki akun dan tidak perlu login.
- Dapat mengunggah foto jalan rusak.
- Dapat melihat titik koordinat dan foto hasil deteksi AI.
- Dapat menjelajahi peta sebaran lubang publik.
- Dapat menerima peringatan jumlah lubang dalam radius $500\text{ meter}$.

### 7.2 Petugas Lapangan Dinas PU (Staff)

Staf teknis dinas yang bertugas meninjau kondisi lapangan dan mengeksekusi penambalan jalan.

- Memiliki akun login dengan peran `petugas`.
- Melihat antrean laporan yang berstatus `PENDING_REVIEW`.
- Mengubah status penanganan: `BARU` $\to$ `DIVERIFIKASI` $\to$ `DALAM_PENANGANAN` $\to$ `SELESAI`.
- Menyembunyikan laporan yang salah deteksi (_false positive_).
- Mengunduh rekapitulasi PDF untuk lampiran Surat Perintah Kerja (SPK).

### 7.3 Administrator Sistem (Admin)

Pimpinan dinas atau staf IT yang mengelola keseluruhan konfigurasi sistem.

- Memiliki akun login dengan peran `admin`.
- Memiliki seluruh hak akses Petugas Lapangan.
- Mengelola akun petugas (menambah petugas baru, me-reset password, menonaktifkan akun).
- Mengubah ambang batas keyakinan deteksi (_confidence threshold_) melalui antarmuka web.
- Memantau rekaman log audit seluruh tindakan petugas.

---

## 8. Authentication Model

Hanya **Petugas** dan **Administrator** yang memerlukan proses autentikasi.

```text
WARGA PUBLIK
    ↓
Tanpa Login (Langsung Lapor & Pantau Peta)

PETUGAS / ADMIN
    ↓
Login Kredensial (/admin/login)
    ↓
Verifikasi Hash Password (Argon2id)
    ↓
Penerbitan Sesi Token JWT (HTTP-Only Cookie)
    ↓
Dashboard Manajemen Dinas
```

---

## 9. Siklus Hidup Laporan (Report Lifecycle)

Status laporan penanganan kerusakan jalan diatur sebagai berikut:

```text
[Unggah Foto Warga]
       ↓
[Inference YOLOv8]
       ├── Confidence < 0.25      --> Ditolak (Tidak ada kerusakan)
       ├── 0.25 <= Conf < 0.65    --> PENDING_REVIEW (Antrean Petugas)
       └── Confidence >= 0.65     --> BARU (Langsung Tampil di Peta Publik)
                                         ↓
                                    DIVERIFIKASI (Petugas Cek Lapangan)
                                         ↓
                                  DALAM_PENANGANAN (Material Aspal Siap)
                                         ↓
                                      SELESAI (Penambalan Tuntas)

* Laporan keliru dapat diubah menjadi DISEMBUNYIKAN (is_hidden = true) kapan saja oleh Petugas/Admin.
```

---

## 10. Information Architecture (Arsitektur Informasi)

### 10.1 Antarmuka Publik

- **`/` (Beranda & Peta Publik):** Menampilkan peta interaktif sebaran kerusakan jalan dengan penanda warna keparahan (Merah: Berat, Kuning: Sedang, Hijau: Ringan), kartu peringatan radius 500m, dan tombol aksi lapor cepat.
- **`/report` (Formulir Unggah):** Antarmuka pemilihan citra dari kamera/galeri, indikator status ekstraksi lokasi EXIF, peta mini untuk penyesuaian pin manual, dan tombol eksekusi deteksi AI.
- **`/report/{id}` (Detail Hasil Deteksi):** Menampilkan foto asli, foto beranotasi kotak pembatas, ringkasan keparahan, kelas kerusakan, dan waktu pelaporan.

### 10.2 Antarmuka Dinas (Panel Terproteksi)

- **`/admin/login`:** Halaman autentikasi kredensial staf dinas.
- **`/admin/dashboard`:** Ringkasan statistik (KPI: Total Laporan, Butuh Verifikasi, Sedang Dikerjakan, Selesai Minggu Ini).
- **`/admin/reports`:** Tabel daftar seluruh laporan kerusakan dilengkapi filter status, keparahan, dan tanggal.
- **`/admin/reports/pending`:** Antrean khusus kurasi laporan `PENDING_REVIEW`.
- **`/admin/pdf-export`:** Panel pemilihan filter tanggal untuk menghasilkan dokumen unduhan PDF resmi dinas.
- **`/admin/users`:** Panel khusus Admin untuk manajemen akun staf.
- **`/admin/settings`:** Panel khusus Admin untuk pengaturan ambang batas keyakinan AI.

---

## 11. Fitur dan Prioritas (Metode MoSCoW)

### Must Have (Mandatori MVP)

1. Unggah foto jalan tanpa kewajiban login.
2. Validasi format berkas citra (JPEG/PNG $\le 10\text{ MB}$) dan penolakan berkas rusak.
3. Inferensi YOLOv8 mendeteksi kelas `pothole` dan `crack`.
4. Ekstraksi koordinat bertingkat: EXIF GPS $\to$ Browser GPS $\to$ Pin manual Leaflet.
5. Formulasi keparahan 2-jalur matematis (Ringan, Sedang, Berat).
6. Penyaringan visibilitas bertingkat ($\ge 0.65$ langsung tampil; $0.25 - 0.64$ masuk antrean verifikasi).
7. Penyimpanan foto asli & beranotasi ke **Supabase Storage**.
8. Penyimpanan metadata laporan ke **Supabase PostgreSQL**.
9. Peta interaktif Leaflet dengan penanda warna tingkat keparahan.
10. Autentikasi petugas dan admin berbasis JWT aman.
11. Pembaruan siklus status laporan (`BARU` $\to$ `DIVERIFIKASI` $\to$ `DALAM_PENANGANAN` $\to$ `SELESAI`).

### Should Have (Sangat Bernilai)

1. Peringatan dini keberadaan lubang aktif dalam radius lingkar $500\text{ meter}$.
2. Fitur moderasi penyembunyian laporan salah (_hide false positive_).
3. Pembuatan laporan rekapitulasi resmi format PDF berfilter rentang tanggal.
4. Manajemen akun petugas lapangan oleh Administrator.
5. Pengaturan ambang batas keyakinan deteksi dinamis oleh Administrator.

### Could Have (Peningkatan Opsional)

1. Penyaringan peta publik berdasarkan tingkat keparahan.
2. Ekspor tabel laporan ke format CSV / Spreadsheet.
3. Statistik ringkas per kelurahan/kecamatan.

### Won't Have (Di Luar Cakupan MVP)

1. Video streaming dashcam real-time.
2. Segmentasi poligon luas aspal.
3. Pengaburan otomatis wajah dan plat nomor kendaraan secara AI.

---

## 12. Core Business Rules (Aturan Bisnis Inti)

1. **Aturan Penyimpanan Selektif:** Sistem tidak akan menyimpan rekaman laporan ke Supabase jika citra yang diunggah tidak memuat sekurang-kurangnya satu deteksi kerusakan dengan keyakinan $\ge 0.25$.
2. **Kedaulatan Keparahan Tertinggi:** Jika terdapat beberapa lubang dalam satu foto, keparahan laporan ditentukan oleh keparahan lubang paling parah (_worst-case_).
3. **Pencegahan Penghapusan Data Fisik (Soft-Hide):** Laporan keliru tidak di-_hard delete_, melainkan ditandai `is_hidden = true` untuk mempertahankan konsistensi data riwayat audit dan pelatihan ulang model.
4. **Imutabilitas Riwayat Status:** Tabel `status_history` bersifat _append-only_ (tidak boleh diedit atau dihapus).
5. **Kerahasiaan Service Role Key:** Kunci backend Supabase berhak penuh (_service role_) hanya boleh berada di server FastAPI dan dilarang keras dikirim ke browser klien.

---

## 13. Core User Stories & Acceptance Criteria

### US-01: Pelaporan Cepat oleh Pengendara

- **As a:** Pengendara / Warga.
- **I want to:** Mengunggah foto jalan rusak dari ponsel saya tanpa mendaftar akun.
- **So that:** Kerusakan dapat segera dilaporkan secara mudah dan cepat.
- **Acceptance Criteria:**
  - Warga dapat memilih foto dari kamera atau galeri.
  - Berkas $>10\text{ MB}$ atau non-gambar ditolak dengan pesan yang jelas.
  - Waktu tunggu proses deteksi hingga hasil tampil $\le 5\text{ detik}$.
  - Jika foto memiliki GPS, pin peta terisi otomatis tanpa perlu ketik alamat.

### US-02: Verifikasi & Penanganan oleh Petugas Dinas

- **As a:** Petugas Lapangan PUPR.
- **I want to:** Membuka antrean laporan dan memperbarui status pekerjaan di lapangan.
- **So that:** Progres penambalan jalan tercatat rapi dan masyarakat mengetahui jalan telah diperbaiki.
- **Acceptance Criteria:**
  - Petugas dapat login dengan kredensial yang valid.
  - Petugas dapat melihat foto asli dan foto beranotasi.
  - Petugas dapat memilih status baru dan menuliskan catatan penanganan.
  - Status laporan terbarui secara langsung pada peta publik.

### US-03: Ekspor Rekapitulasi Berkas PDF Resmi

- **As a:** Kepala Seksi Pemeliharaan Jalan / Admin Dinas.
- **I want to:** Mengunduh berkas laporan format PDF berdasarkan filter rentang tanggal.
- **So that:** Saya memiliki dokumen fisik resmi untuk lampiran Surat Perintah Kerja dan rapat dinas.
- **Acceptance Criteria:**
  - Pengguna dapat memilih tanggal awal dan tanggal akhir.
  - Berkas PDF yang dihasilkan memuat kop resmi dinas, tabel ringkasan statistik keparahan, dan tabel rincian lokasi laporan.

---

## 14. Testing Requirements & QA Checklist

Sebelum sistem dirilis ke tahap demonstrasi atau operasional dinas, wajib melalui pengujian:

- [ ] Pengujian unggah file format palsu (misal berkas `.exe` diubah menjadi `.jpg`) harus ditolak oleh validator _magic bytes_.
- [ ] Pengujian ekstraksi EXIF pada foto ber-GPS dan foto tanpa GPS (fallback berfungsi sempurna).
- [ ] Pengujian batas kuota unggah (_Rate Limiting_): Request ke-6 dalam 1 menit dari IP yang sama harus mengembalikan HTTP 429.
- [ ] Pengujian proteksi rute API dinas: Request tanpa token JWT valid wajib ditolak dengan HTTP 401/403.
- [ ] Pengujian penulisan data dan pengunggahan berkas ke Supabase Cloud (Storage & PostgreSQL).
- [ ] Pengujian pembuatan berkas PDF untuk memastikan tabel dan font ter-render dengan sempurna.

---

## 15. Definition of Done (DoD)

Fitur dinyatakan tuntas apabila:

1. Memenuhi seluruh spesifikasi kebutuhan fungsional dan kriteria penerimaan (_Acceptance Criteria_).
2. Lolos seluruh skenario uji (_test cases_) unit dan integrasi.
3. Terkoneksi dengan basis data Supabase PostgreSQL dan Supabase Storage secara stabil.
4. Tampilan antarmuka responsif pada layar ponsel pintar ($375\text{px}$) hingga monitor desktop ($1920\text{px}$).
5. Tidak terdapat celah kerentanan keamanan kritis (_no high/critical security vulnerabilities_).
