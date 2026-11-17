-- ==============================================================================
-- POTHOLESCAN: SKRIP INISIALISASI BASIS DATA SUPABASE POSTGRESQL + POSTGIS
-- Jalankan skrip ini langsung di menu: Supabase Dashboard -> SQL Editor -> New Query
-- ==============================================================================

-- 1. Mengaktifkan ekstensi geospasial PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Tabel Akun Pengguna (Petugas Lapangan & Administrator Dinas PUPR)
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('petugas', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Tabel Master Laporan Kerusakan Jalan (Pothole & Crack)
CREATE TABLE IF NOT EXISTS public.reports (
    id BIGSERIAL PRIMARY KEY,
    image_url TEXT NOT NULL,
    annotated_image_url TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326),
    location_source VARCHAR(20) NOT NULL CHECK (location_source IN ('exif', 'browser', 'manual')),
    max_severity VARCHAR(20) NOT NULL CHECK (max_severity IN ('RINGAN', 'SEDANG', 'BERAT')),
    max_confidence REAL NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'BARU' CHECK (status IN ('PENDING_REVIEW', 'BARU', 'DIVERIFIKASI', 'DALAM_PENANGANAN', 'SELESAI')),
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    model_version VARCHAR(50) NOT NULL DEFAULT 'yolov8s-v1.0.pt',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger otomatis mengisi kolom PostGIS geom setiap kali latitude/longitude dimasukkan atau diperbarui
CREATE OR REPLACE FUNCTION public.set_report_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_report_geom ON public.reports;
CREATE TRIGGER trg_set_report_geom
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.set_report_geom();

-- Indeks Spasial GiST untuk kueri radius proksimitas super cepat
CREATE INDEX IF NOT EXISTS idx_reports_geom ON public.reports USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_is_hidden ON public.reports (is_hidden);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports (created_at DESC);

-- 4. Tabel Rincian Kotak Deteksi Kerusakan (Hasil Inferensi YOLOv8)
CREATE TABLE IF NOT EXISTS public.detections (
    id BIGSERIAL PRIMARY KEY,
    report_id BIGINT NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    class_name VARCHAR(20) NOT NULL CHECK (class_name IN ('pothole', 'crack')),
    confidence REAL NOT NULL,
    bbox_x REAL NOT NULL,
    bbox_y REAL NOT NULL,
    bbox_w REAL NOT NULL,
    bbox_h REAL NOT NULL,
    area_ratio REAL NOT NULL,
    severity VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_detections_report_id ON public.detections (report_id);

-- 5. Tabel Riwayat Perubahan Status (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS public.status_history (
    id BIGSERIAL PRIMARY KEY,
    report_id BIGINT NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    old_status VARCHAR(30) NOT NULL,
    new_status VARCHAR(30) NOT NULL,
    changed_by VARCHAR(50) NOT NULL,
    notes TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_status_history_report_id ON public.status_history (report_id);

-- 6. Tabel Konfigurasi Sistem Dinamis
CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Inisialisasi Konfigurasi Baku
INSERT INTO public.system_settings (key, value, description) VALUES
('confidence_threshold_min', '0.25', 'Ambang batas minimal agar deteksi diterima'),
('confidence_threshold_publish', '0.65', 'Ambang batas keyakinan langsung tampil di peta publik'),
('proximity_radius_meters', '500', 'Radius peringatan lubang aktif sekitar pengendara')
ON CONFLICT (key) DO NOTHING;

-- 7. Tabel Log Audit Administrator
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_username VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_entity VARCHAR(50) NOT NULL,
    target_id BIGINT,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

-- ==============================================================================
-- 8. Row Level Security (RLS) Policies
-- ==============================================================================
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy Reports: Publik dapat melihat laporan aktif yang tidak tersembunyi
DROP POLICY IF EXISTS "Public Read Active Reports" ON public.reports;
CREATE POLICY "Public Read Active Reports"
ON public.reports FOR SELECT
TO anon, authenticated
USING (is_hidden = false AND status IN ('BARU', 'DIVERIFIKASI', 'DALAM_PENANGANAN', 'SELESAI'));

-- Policy Reports: Service Role (Backend FastAPI) memiliki akses penuh
DROP POLICY IF EXISTS "Service Role Full Access Reports" ON public.reports;
CREATE POLICY "Service Role Full Access Reports"
ON public.reports FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy Detections: Publik dapat membaca deteksi pada laporan yang berhak dibaca
DROP POLICY IF EXISTS "Public Read Detections" ON public.detections;
CREATE POLICY "Public Read Detections"
ON public.detections FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Service Role Full Access Detections" ON public.detections;
CREATE POLICY "Service Role Full Access Detections"
ON public.detections FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy Settings: Publik dapat membaca konfigurasi sistem
DROP POLICY IF EXISTS "Public Read Settings" ON public.system_settings;
CREATE POLICY "Public Read Settings"
ON public.system_settings FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Service Role Full Access Settings" ON public.system_settings;
CREATE POLICY "Service Role Full Access Settings"
ON public.system_settings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy Users & Logs: Hanya Service Role
DROP POLICY IF EXISTS "Service Role Full Access Users" ON public.users;
CREATE POLICY "Service Role Full Access Users"
ON public.users FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Access Status History" ON public.status_history;
CREATE POLICY "Service Role Full Access Status History"
ON public.status_history FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Access Audit Logs" ON public.audit_logs;
CREATE POLICY "Service Role Full Access Audit Logs"
ON public.audit_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- 9. Storage Bucket: potholescan-media
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('potholescan-media', 'potholescan-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy Storage: Publik dapat melihat foto asli & teranotasi
DROP POLICY IF EXISTS "Public Access Pothole Media" ON storage.objects;
CREATE POLICY "Public Access Pothole Media"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'potholescan-media');

-- Policy Storage: Service Role dapat mengunggah dan mengelola berkas
DROP POLICY IF EXISTS "Service Role Storage Access" ON storage.objects;
CREATE POLICY "Service Role Storage Access"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'potholescan-media')
WITH CHECK (bucket_id = 'potholescan-media');
