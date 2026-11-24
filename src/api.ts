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

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const DEFAULT_HEADERS: Record<string, string> = {
  "ngrok-skip-browser-warning": "true",
};

const TOKEN_KEY = "potholescan_token";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers = { ...DEFAULT_HEADERS, ...extraHeaders };
  const token = getStoredToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function checkHealthApi(): Promise<{
  status: string;
  ai_engine: string;
  supabase_connected: boolean;
}> {
  const res = await fetch(`${API_BASE}/health`, {
    headers: DEFAULT_HEADERS,
  });
  if (!res.ok) throw new Error("Gagal memeriksa status sistem.");
  return res.json();
}

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
    headers: DEFAULT_HEADERS,
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
  includeHidden: boolean = true,
): Promise<{ total: number; items: ApiReportItem[] }> {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.append("status", status);
  if (severity && severity !== "ALL") params.append("severity", severity);
  if (includeHidden) params.append("include_hidden", "true");

  const res = await fetch(`${API_BASE}/reports?${params.toString()}`, {
    headers: DEFAULT_HEADERS,
  });
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
    { headers: DEFAULT_HEADERS },
  );
  if (!res.ok) {
    throw new Error("Gagal memeriksa titik waspada terdekat.");
  }
  return res.json();
}

export async function loginApi(username: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { ...DEFAULT_HEADERS, "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login gagal." }));
    throw new Error(err.detail || "Kredensial tidak valid.");
  }
  const data = await res.json();
  if (data.access_token) {
    setStoredToken(data.access_token);
  }
  return data;
}

export async function logoutApi() {
  setStoredToken(null);
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
  }).catch(() => {});
}

export async function updateReportStatusApi(
  id: number,
  newStatus: string,
  notes: string = "",
  hide: boolean = false,
) {
  const res = await fetch(`${API_BASE}/reports/${id}/status`, {
    method: "PATCH",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
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
  const res = await fetch(`${API_BASE}/settings`, {
    headers: DEFAULT_HEADERS,
    credentials: "include",
  });
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
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
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
  status: string = "ALL",
): string {
  const params = new URLSearchParams();
  params.append("from_date", fromDate);
  params.append("to_date", toDate);
  params.append("status", status);
  const token = getStoredToken();
  if (token) params.append("token", token);
  return `${API_BASE}/reports/pdf?${params.toString()}`;
}

export function getExcelDownloadUrl(
  fromDate?: string,
  toDate?: string,
  status: string = "ALL",
): string {
  const params = new URLSearchParams();
  if (fromDate) params.append("from_date", fromDate);
  if (toDate) params.append("to_date", toDate);
  if (status) params.append("status", status);
  const token = getStoredToken();
  if (token) params.append("token", token);
  return `${API_BASE}/reports/export/excel?${params.toString()}`;
}

export async function downloadExcelApi(
  fromDate?: string,
  toDate?: string,
  status: string = "ALL",
): Promise<Blob> {
  const url = getExcelDownloadUrl(fromDate, toDate, status);
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.detail || `Gagal mengunduh berkas Excel (HTTP ${res.status}).`);
  }
  return res.blob();
}

export async function downloadPdfApi(
  fromDate: string,
  toDate: string,
  status: string = "ALL",
): Promise<Blob> {
  const url = getPdfDownloadUrl(fromDate, toDate, status);
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.detail || `Gagal mengunduh berkas PDF (HTTP ${res.status}).`);
  }
  return res.blob();
}

export async function fetchUsersApi() {
  const res = await fetch(`${API_BASE}/auth/users`, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
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
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
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
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Gagal menghapus akun staf.");
  return res.json();
}

export async function deleteReportApi(reportId: number) {
  const res = await fetch(`${API_BASE}/reports/${reportId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ detail: "Gagal menghapus laporan." }));
    throw new Error(err.detail || "Gagal menghapus laporan.");
  }
  return res.json();
}
