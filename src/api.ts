// PotholeScan API Client
export interface ApiDetection {
  class_name: "pothole" | "crack";
  confidence: number;
  bbox: [number, number, number, number];
  area_ratio: number;
  severity: "BERAT" | "SEDANG" | "RINGAN";
}

export interface ApiReportResponse {
  success: boolean;
  status: string;
  report_id?: number;
  is_published_immediately: boolean;
  location?: {
    latitude: number;
    longitude: number;
    source: "exif" | "browser" | "manual";
  };
  severity?: "BERAT" | "SEDANG" | "RINGAN";
  max_confidence?: number;
  image_url?: string;
  annotated_image_url?: string;
  detections: ApiDetection[];
  nearby_unresolved_count: number;
  message?: string;
}

export interface ApiReportItem {
  id: number;
  image_url: string;
  annotated_image_url: string;
  latitude: number;
  longitude: number;
  location_source: string;
  max_severity: "BERAT" | "SEDANG" | "RINGAN";
  max_confidence: number;
  status:
    "PENDING_REVIEW" | "BARU" | "DIVERIFIKASI" | "DALAM_PENANGANAN" | "SELESAI";
  is_hidden: boolean;
  model_version: string;
  created_at: string;
  updated_at: string;
  detections?: ApiDetection[];
}

export interface ApiNearbyResponse {
  center: { lat: number; lon: number };
  radius_meters: number;
  unresolved_damages_count: number;
  highest_severity?: "BERAT" | "SEDANG" | "RINGAN";
}

const API_BASE = "/api";

export async function submitReport(
  file: Blob | File,
  latitude?: number,
  longitude?: number,
): Promise<ApiReportResponse> {
  const form = new FormData();
  form.append("file", file, "pothole_upload.jpg");
  if (latitude !== undefined) form.append("latitude", latitude.toString());
  if (longitude !== undefined) form.append("longitude", longitude.toString());

  const res = await fetch(`${API_BASE}/reports`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ detail: "Terjadi kesalahan sistem." }));
    throw new Error(err.detail || "Gagal memproses laporan.");
  }
  return res.json();
}

export async function fetchReports(
  status?: string,
  severity?: string,
): Promise<{ total: number; items: ApiReportItem[] }> {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.append("status", status);
  if (severity && severity !== "ALL") params.append("severity", severity);

  const res = await fetch(`${API_BASE}/reports?${params.toString()}`);
  if (!res.ok) {
    throw new Error("Gagal mengambil daftar laporan.");
  }
  return res.json();
}

export async function fetchNearby(
  lat: number,
  lon: number,
  radius: number = 500,
): Promise<ApiNearbyResponse> {
  const res = await fetch(
    `${API_BASE}/nearby?lat=${lat}&lon=${lon}&radius_m=${radius}`,
  );
  if (!res.ok) {
    throw new Error("Gagal memeriksa titik waspada terdekat.");
  }
  return res.json();
}

export async function loginApi(username: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login gagal." }));
    throw new Error(err.detail || "Kredensial tidak valid.");
  }
  return res.json();
}

export async function logoutApi() {
  await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
}

export async function updateReportStatusApi(
  id: number,
  newStatus: string,
  notes: string = "",
  hide: boolean = false,
) {
  const res = await fetch(`${API_BASE}/reports/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      new_status: newStatus,
      notes,
      hide_false_positive: hide,
    }),
  });

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ detail: "Gagal memperbarui status." }));
    throw new Error(err.detail || "Gagal memperbarui status.");
  }
  return res.json();
}

export async function fetchSettingsApi() {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error("Gagal mengambil pengaturan.");
  return res.json();
}

export async function updateSettingsApi(settings: {
  min?: number;
  publish?: number;
  radius?: number;
}) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      confidence_threshold_min: settings.min,
      confidence_threshold_publish: settings.publish,
      proximity_radius_meters: settings.radius,
    }),
  });
  if (!res.ok) throw new Error("Gagal memperbarui ambang batas.");
  return res.json();
}

export function getPdfDownloadUrl(
  fromDate: string,
  toDate: string,
  status: string = "SEMUA",
): string {
  return `${API_BASE}/reports/pdf?from_date=${fromDate}&to_date=${toDate}&status=${status}`;
}

export function getExcelDownloadUrl(
  fromDate?: string,
  toDate?: string,
  status: string = "SEMUA",
): string {
  const params = new URLSearchParams();
  if (fromDate) params.append("from_date", fromDate);
  if (toDate) params.append("to_date", toDate);
  if (status) params.append("status", status);
  return `${API_BASE}/reports/export/excel?${params.toString()}`;
}

export async function fetchUsersApi() {
  const res = await fetch(`${API_BASE}/auth/users`);
  if (!res.ok) throw new Error("Gagal mengambil daftar pengguna.");
  return res.json();
}

export async function createUserApi(user: {
  username: string;
  password: string;
  fullName: string;
  role: string;
}) {
  const res = await fetch(`${API_BASE}/auth/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: user.username,
      password: user.password,
      full_name: user.fullName,
      role: user.role,
    }),
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ detail: "Gagal membuat pengguna baru." }));
    throw new Error(err.detail || "Gagal membuat pengguna baru.");
  }
  return res.json();
}

export async function deleteUserApi(userId: number) {
  const res = await fetch(`${API_BASE}/auth/users/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Gagal menghapus akun staf.");
  return res.json();
}
