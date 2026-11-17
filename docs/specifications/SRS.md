# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

# SISTEM DETEKSI KERUSAKAN JALAN (POTHOLESCAN)

**Standard:** IEEE Std 830-1998  
**Document Version:** 1.0 (Definitive Edition)  
**Status:** Approved for Engineering & Evaluation  
**Product:** PotholeScan Web Platform  
**Target Organization:** Dinas Pekerjaan Umum dan Penataan Ruang (PUPR)

---

## DAFTAR ISI

1. [Pendahuluan](#1-pendahuluan)
   - 1.1 Tujuan Dokumen
   - 1.2 Lingkup Produk
   - 1.3 Definisi, Istilah, dan Singkatan
   - 1.4 Referensi Standar
2. [Deskripsi Umum](#2-deskripsi-umum)
   - 2.1 Perspektif Produk
   - 2.2 Fungsi Utama Sistem
   - 2.3 Karakteristik Pengguna
   - 2.4 Batasan Umum
   - 2.5 Asumsi dan Ketergantungan
3. [Kebutuhan Spesifik](#3-kebutuhan-spesifik)
   - 3.1 Antarmuka Eksternal (UI, Software, Hardware, Network)
   - 3.2 Kebutuhan Fungsional (FR-01 s.d. FR-18)
   - 3.3 Kebutuhan Data dan Model Machine Learning (ML-01 s.d. ML-09)
   - 3.4 Kebutuhan Non-Fungsional (NFR-01 s.d. NFR-10)
   - 3.5 Batasan Desain
4. [Matriks Ketertelusuran Kebutuhan (RTM)](#4-matriks-ketertelusuran-kebutuhan-rtm)

---

## 1. Pendahuluan

### 1.1 Tujuan Dokumen

Dokumen Spesifikasi Kebutuhan Perangkat Lunak (_Software Requirements Specification_ - SRS) ini menetapkan seluruh kebutuhan fungsional, kebutuhan kinerja, kebutuhan antarmuka, dan kebutuhan data bagi sistem **PotholeScan**. Dokumen ini menjadi acuan formal bagi pengembang perangkat lunak, perancang sistem, penguji kualitas (_QA_), serta dewan penguji akademik/evaluator dinas.

### 1.2 Lingkup Produk

PotholeScan adalah aplikasi web cerdas yang mendeteksi kerusakan jalan (lubang dan retak) menggunakan model _deep learning_ YOLOv8, mengekstrak koordinat lokasi secara otomatis, memvisualisasikan data pada peta interaktif, serta menyediakan layanan terpadu manajemen perbaikan jalan yang terintegrasi dengan **Supabase Cloud (PostgreSQL + PostGIS & Supabase Storage)**.

### 1.3 Definisi, Istilah, dan Singkatan

- **SRS:** _Software Requirements Specification_ (Spesifikasi Kebutuhan Perangkat Lunak).
- **YOLO:** _You Only Look Once_ (Arsitektur deteksi objek satu tahap berkecepatan tinggi).
- **mAP:** _Mean Average Precision_ (Metrik evaluasi akurasi deteksi objek).
- **IoU:** _Intersection over Union_ (Rasio tumpang tindih antara kotak prediksi dan kotak acuan).
- **BBox:** _Bounding Box_ (Kotak koordinat segiempat pembatas objek kerusakan).
- **EXIF:** _Exchangeable Image File Format_ (Metadata yang tersimpan dalam berkas citra digital, mencakup koordinat GPS).
- **PostGIS:** Ekstensi basis data spasial untuk PostgreSQL yang memungkinkan eksekusi kueri lokasi geografis berkinerja tinggi.
- **Supabase Storage:** Layanan penyimpanan objek berbasis cloud yang kompatibel dengan protokol AWS S3.
- **JWT:** _JSON Web Token_ (Standar token otentikasi terenkripsi berbasis RFC 7519).

### 1.4 Referensi Standar

- IEEE Std 830-1998: _IEEE Recommended Practice for Software Requirements Specifications_.
- ISO/IEC/IEEE 29148:2018: _Systems and software engineering — Life cycle processes — Requirements engineering_.
- Dokumentasi Ultralytics YOLOv8 (2023-2026).
- Dokumentasi Resmi Supabase Database & Storage (2024-2026).

---

## 2. Deskripsi Umum

### 2.1 Perspektif Produk

PotholeScan adalah sistem web hibrida independen yang memadukan arsitektur komputasi AI di sisi server backend (FastAPI) dengan layanan terkelola cloud (**Supabase**) untuk persistensi data dan media:

```text
[Browser Klien]
      │ HTTPS (JSON / Multipart)
      ▼
[Backend FastAPI] ──► [Inference Engine YOLOv8]
      │
      ├──► [Supabase Storage]    (Penyimpanan Berkas Foto Asli & Anotasi)
      └──► [Supabase PostgreSQL] (Tabel Relasional, Riwayat Status & PostGIS)
```

### 2.2 Fungsi Utama Sistem

1. Pengunggahan foto jalan secara cepat tanpa login.
2. Validasi berkas citra dan ekstraksi koordinat lokasi (EXIF / GPS / Pin Peta).
3. Deteksi otomatis objek lubang (_pothole_) dan retak (_crack_) menggunakan YOLOv8.
4. Formulasi matematis tingkat keparahan kerusakan (Ringan, Sedang, Berat).
5. Penyaringan visibilitas bertingkat berbasis nilai keyakinan (_confidence_).
6. Visualisasi sebaran titik kerusakan pada peta interaktif Leaflet.
7. Peringatan dini keberadaan lubang aktif dalam radius $500\text{ meter}$.
8. Otentikasi dan otorisasi bertingkat untuk Petugas Lapangan dan Administrator.
9. Pembaruan siklus status perbaikan jalan (`BARU`, `DIVERIFIKASI`, `DALAM_PENANGANAN`, `SELESAI`).
10. Moderasi penyembunyian laporan keliru (_soft-hide false positive_).
11. Pembuatan dan pengunduhan berkas laporan rekapitulasi dinas format PDF.

### 2.3 Karakteristik Pengguna

| Peran Pengguna          | Otentikasi | Hak Akses Utama                                                                                         |
| :---------------------- | :--------: | :------------------------------------------------------------------------------------------------------ |
| **Pengendara (Warga)**  |   Tidak    | Mengunggah foto jalan, melihat hasil deteksi, melihat peta publik, menerima peringatan radius 500m.     |
| **Petugas Lapangan PU** | Ya (Login) | Semua hak warga + review laporan pending, ubah status perbaikan, sembunyikan laporan keliru, unduh PDF. |
| **Administrator**       | Ya (Login) | Semua hak petugas + kelola akun petugas, ubah ambang batas keyakinan, akses log audit sistem.           |

### 2.4 Batasan Umum

- Masukan dibatasi pada citra foto statis digital (format JPEG/PNG, $\le 10\text{ MB}$).
- Deteksi optimal pada kondisi pencahayaan siang hari.
- Bergantung pada ketersediaan koneksi internet aktif untuk berkomunikasi dengan layanan Supabase Cloud dan ubin OpenStreetMap.

### 2.5 Asumsi dan Ketergantungan

- Pengguna diasumsikan menggunakan peramban modern (_Chrome, Firefox, Safari, Edge_) dengan dukungan JavaScript dan geolokasi.
- Kamera pengguna memiliki lensa yang bersih dan menghasilkan resolusi minimal $640 \times 640$ piksel.
- Akun layanan Supabase Cloud aktif dan kredensial API telah terkonfigurasi pada berkas `.env` server.

---

## 3. Kebutuhan Spesifik

### 3.1 Antarmuka Eksternal

#### 3.1.1 Antarmuka Pengguna (User Interface)

- Tampilan responsif dengan prinsip _mobile-first design_ menggunakan Tailwind CSS.
- Panel peta interaktif Leaflet dengan penanda warna sesuai derajat keparahan (Merah: Berat, Kuning: Sedang, Hijau: Ringan).
- Dasbor operasional dinas yang memisahkan antrean `Pending Review`, daftar pekerjaan aktif, dan riwayat perbaikan.

#### 3.1.2 Antarmuka Perangkat Lunak (Software Interface)

- **FastAPI REST API:** Protokol komunikasi HTTP/HTTPS dengan format muatan JSON dan `multipart/form-data`.
- **Supabase Cloud API:** Menggunakan `supabase-py` dan pustaka `asyncpg` untuk eksekusi kueri PostgreSQL dan operasi _bucket storage_.
- **OpenStreetMap Tile Service:** Mengonsumsi ubin peta standar via protokol HTTP raster slippy maps.

#### 3.1.3 Antarmuka Perangkat Keras (Hardware Interface)

- **Sisi Server:** Minimal 4 vCPU, 8 GB RAM, dan ruang penyimpanan disk SSD untuk menampung _cache_ inferensi sementara.
- **Sisi Klien:** Smartphone atau komputer dengan layar minimal resolusi $375 \times 667$ piksel dan koneksi internet.

#### 3.1.4 Antarmuka Komunikasi

- Enkripsi komunikasi data menggunakan protokol standar TLS 1.3 / HTTPS.

---

### 3.2 Kebutuhan Fungsional (Functional Requirements)

| ID        | Nama Kebutuhan                 | Deskripsi Alur & Spesifikasi Teknis                                                                                                                                                              | Prioritas  |
| :-------- | :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------: |
| **FR-01** | Unggah Foto Tanpa Login        | Pengguna publik dapat mengunggah berkas citra jalan melalui peramban web tanpa kewajiban autentikasi.                                                                                            |  **Must**  |
| **FR-02** | Validasi Format & Ukuran       | Sistem memverifikasi _magic bytes_ citra (JPEG/PNG) dan menolak berkas dengan ukuran $>10\text{ MB}$ (HTTP 422).                                                                                 |  **Must**  |
| **FR-03** | Penentuan Lokasi Bertingkat    | Sistem mengekstrak lintang dan bujur dari tag EXIF GPS citra; jika nihil, sistem meminta geolokasi browser; jika ditolak, pengguna menempatkan pin manual di peta Leaflet.                       |  **Must**  |
| **FR-04** | Inferensi Deteksi YOLOv8       | Sistem menjalankan model YOLOv8 untuk melokalisasi objek `pothole` dan `crack` beserta koordinat kotak pembatas dan skor keyakinan.                                                              |  **Must**  |
| **FR-05** | Filter Ambang Keyakinan        | Sistem hanya memproses deteksi yang memiliki skor keyakinan $\ge 0.25$. Deteksi di bawah ambang batas ini dibuang (_discarded_).                                                                 |  **Must**  |
| **FR-06** | Formulasi Keparahan Matematis  | Sistem menghitung rasio luas ($R_{\text{area}}$) untuk lubang dan rasio dimensi terpanjang ($R_{\text{span}}$) untuk retak, lalu mengklasifikasikan ke dalam derajat Ringan, Sedang, atau Berat. |  **Must**  |
| **FR-07** | Penyimpanan Media Supabase     | Sistem mengunggah foto asli dan foto beranotasi kotak pembatas ke bucket Supabase Storage (`potholescan-media`).                                                                                 |  **Must**  |
| **FR-08** | Persistensi Database Supabase  | Sistem mencatat metadata laporan, URL foto Supabase, koordinat lokasi, dan objek deteksi ke dalam Supabase PostgreSQL.                                                                           |  **Must**  |
| **FR-09** | Filter Visibilitas Bertingkat  | Deteksi dengan keyakinan $\ge 0.65$ otomatis terbit di peta publik (status `BARU`); deteksi dengan keyakinan $0.25 - 0.64$ masuk antrean verifikasi petugas (status `PENDING_REVIEW`).           |  **Must**  |
| **FR-10** | Visualisasi Peta Publik        | Sistem menampilkan seluruh laporan aktif yang tidak tersembunyi pada peta Leaflet dengan penanda warna sesuai derajat keparahan.                                                                 |  **Must**  |
| **FR-11** | Peringatan Proksimitas 500m    | Sistem mengeksekusi kueri spasial PostGIS untuk menghitung jumlah kerusakan aktif dalam radius $500\text{ meter}$ dari titik pelapor.                                                            | **Should** |
| **FR-12** | Autentikasi Pengguna Dinas     | Sistem menyediakan fitur login berbasis token JWT terenkripsi untuk peran `petugas` dan `admin`.                                                                                                 |  **Must**  |
| **FR-13** | Kurasi Laporan Pending         | Petugas dan Admin dapat menyetujui penayangan laporan `PENDING_REVIEW` ke peta publik atau membuang laporan yang tidak valid.                                                                    |  **Must**  |
| **FR-14** | Pembaruan Siklus Penanganan    | Petugas dapat mengubah status penanganan (`BARU` $\to$ `DIVERIFIKASI` $\to$ `DALAM_PENANGANAN` $\to$ `SELESAI`) disertai catatan progres.                                                        |  **Must**  |
| **FR-15** | Moderasi Penyembunyian Laporan | Petugas dan Admin dapat menyembunyikan laporan keliru (_is_hidden = true_) tanpa menghapus rekaman fisik dari basis data.                                                                        | **Should** |
| **FR-16** | Ekspor Rekapitulasi Berkas PDF | Petugas dan Admin dapat mengunduh dokumen rekapitulasi resmi format PDF berfilter rentang tanggal penanganan.                                                                                    | **Should** |
| **FR-17** | Manajemen Akun Petugas         | Administrator dapat menambah akun petugas baru, me-reset kata sandi, atau menonaktifkan status aktif akun petugas.                                                                               | **Should** |
| **FR-18** | Konfigurasi Ambang Keyakinan   | Administrator dapat memperbarui nilai ambang batas keyakinan publikasi langsung secara dinamis melalui dashboard.                                                                                | **Should** |

---

### 3.3 Kebutuhan Data & Model Machine Learning

| ID        | Parameter Kebutuhan         | Spesifikasi Teknis                                                                                                         |
| :-------- | :-------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **ML-01** | Definisi Target Kelas       | Model mengenali 2 kelas keluaran: Kelas 0 = `pothole`, Kelas 1 = `crack`.                                                  |
| **ML-02** | Format Masukan Citra        | Matriks citra 3-channel RGB yang di-_letterbox resize_ ke dimensi $640 \times 640$ piksel.                                 |
| **ML-03** | Format Keluaran Prediksi    | Matriks koordinat kotak normalisasi $[x_c, y_c, w, h]$, skor keyakinan ($0.0 - 1.0$), dan ID kelas.                        |
| **ML-04** | Metrik Keberhasilan Minimal | Pada data uji Kaggle/RDD2022: $\text{mAP@0.5} \ge 0.70$, $\text{Recall Pothole} \ge 0.75$, $\text{Recall Crack} \ge 0.70$. |
| **ML-05** | Latensi Inferensi Maksimal  | Waktu komputasi satu citra pada server CPU $\le 1.0\text{ detik}$.                                                         |
| **ML-06** | Ketertelusuran Versi Model  | Setiap baris laporan di Supabase PostgreSQL wajib mencatat versi berkas bobot model yang aktif (misal `yolov8s-v1.0.pt`).  |
| **ML-07** | Pencegahan Kebocoran Data   | Partisi data latih dan uji wajib dipisahkan berdasarkan sekuens ruas jalan rekaman.                                        |
| **ML-08** | Keterulangan Ilmiah         | Pelatihan menetapkan _seed_ acak tetap (`seed=42`) dan menyimpan konfigurasi hyperparameter lengkap.                       |
| **ML-09** | Penanganan Kesalahan Model  | Eksepsi komputasi tensor ditangkap secara aman dan mengembalikan pesan galat terstruktur tanpa mematikan server FastAPI.   |

---

### 3.4 Kebutuhan Non-Fungsional (Non-Functional Requirements)

- **NFR-01 (Kinerja Waktu Respons):** Seluruh siklus proses dari pengunggahan hingga penayangan hasil deteksi tidak boleh melebihi $5.0\text{ detik}$ pada koneksi jaringan seluler standar.
- **NFR-02 (Keamanan Kata Sandi):** Kata sandi petugas dan admin disimpan dalam bentuk hash _Argon2id_ yang aman dari serangan _rainbow table_ atau _brute force_.
- **NFR-03 (Proteksi Rute Privat):** Endpoint mutasi data wajib memvalidasi token JWT; request tanpa izin ditolak dengan status HTTP 401/403.
- **NFR-04 (Pencegahan Serangan DoS):** Endpoint publik `/api/reports` diproteksi _rate limiter_ dengan batas maksimal 5 request per menit per alamat IP.
- **NFR-05 (Integritas Spasial PostGIS):** Koordinat geografis divalidasi pada rentang lintang $-90.0$ s.d. $+90.0$ dan bujur $-180.0$ s.d. $+180.0$ serta diindeks menggunakan indeks spasial GiST di Supabase.
- **NFR-06 (Kemudahan Penggunaan):** Warga dapat menuntaskan pelaporan dalam $\le 3\text{ langkah tindakan}$ intuitif di layar ponsel.
- **NFR-07 (Kompatibilitas Peramban):** Antarmuka web berjalan konsisten pada Chrome, Firefox, Safari, dan Edge versi terkini.
- **NFR-08 (Kapasitas Skala MVP):** Sistem mampu melayani hingga 10 pengguna bersamaan (_concurrent users_) dan mengelola hingga 25.000 titik laporan di Supabase tanpa penurunan performa kueri.
- **NFR-09 (Keterawatan & Kerapian Kode):** Kode backend dan frontend ditulis modular dengan pemisahan dependensi ketat dan dokumentasi otomatis OpenAPI/Swagger.
- **NFR-10 (Ketertelusuran Pengujian):** Setiap butir FR dan ML wajib memiliki skenario kasus uji (_test case_) yang terdokumentasi.

---

### 3.5 Batasan Desain

- Database backend: **Supabase PostgreSQL** dengan ekstensi **PostGIS**.
- Penyimpanan berkas foto: **Supabase Storage**.
- Server logika dan inferensi: **FastAPI (Python 3.11+)** + **Ultralytics YOLOv8**.
- Peta interaktif: **Leaflet** + ubin **OpenStreetMap**.

---

## 4. Matriks Ketertelusuran Kebutuhan (RTM)

| Kebutuhan Fungsional | Kebutuhan ML     | Kebutuhan NFR  | Komponen / Modul Pemenuh             | Kasus Uji Acuan        |
| :------------------- | :--------------- | :------------- | :----------------------------------- | :--------------------- |
| **FR-01, FR-02**     | -                | NFR-01, NFR-04 | Upload Validator & Rate Limiter      | TC-UPL-01, TC-UPL-02   |
| **FR-03**            | -                | NFR-05, NFR-06 | GeoService (EXIF & PostGIS)          | TC-GEO-01, TC-GEO-02   |
| **FR-04, FR-05**     | ML-01 s.d. ML-05 | NFR-01, NFR-09 | YOLOv8 Inference Engine              | TC-INF-01, TC-INF-02   |
| **FR-06**            | -                | NFR-09         | Severity Calculator Module           | TC-SEV-01, TC-SEV-02   |
| **FR-07, FR-08**     | ML-06            | NFR-05, NFR-08 | Supabase Storage & PostgreSQL Client | TC-SUPA-01, TC-SUPA-02 |
| **FR-09, FR-10**     | -                | NFR-06, NFR-07 | Tiered Visibility & Leaflet UI       | TC-VIS-01, TC-MAP-01   |
| **FR-11**            | -                | NFR-01, NFR-05 | PostGIS Proximity Engine             | TC-PROX-01             |
| **FR-12, FR-17**     | -                | NFR-02, NFR-03 | AuthService & JWT Manager            | TC-AUTH-01, TC-AUTH-02 |
| **FR-13, FR-14**     | -                | NFR-03, NFR-08 | Staff Review & Status Manager        | TC-STAT-01, TC-STAT-02 |
| **FR-15**            | -                | NFR-03         | Visibility Moderation Service        | TC-MOD-01              |
| **FR-16**            | -                | NFR-01, NFR-09 | ReportLab PDF Engine                 | TC-PDF-01              |
| **FR-18**            | -                | NFR-03         | Dynamic Settings Repository          | TC-SET-01              |
