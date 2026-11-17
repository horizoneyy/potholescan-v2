export type Severity = 'BERAT' | 'SEDANG' | 'RINGAN'
export type Status = 'PENDING_REVIEW' | 'BARU' | 'DIVERIFIKASI' | 'DALAM_PENANGANAN' | 'SELESAI'

export interface Report {
  id: number
  street: string
  x: number // percent on map fallback
  y: number
  lat?: number
  lon?: number
  severity: Severity
  status: Status
  confidence: number
  kind: 'pothole' | 'crack'
  hidden: boolean
  date: string
  notes?: string
  img: string
  annotated_img?: string
  iso: string
}

export const SEV_COLOR: Record<Severity, string> = {
  BERAT: '#e5484d',
  SEDANG: '#f5a524',
  RINGAN: '#30a46c',
}

export const STATUS_LABEL: Record<Status, string> = {
  PENDING_REVIEW: 'Pending review',
  BARU: 'Baru',
  DIVERIFIKASI: 'Diverifikasi',
  DALAM_PENANGANAN: 'Dalam penanganan',
  SELESAI: 'Selesai',
}

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=240&h=240&q=70`

const MONTHS: Record<string, string> = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  Mei: '05',
  May: '05',
  Jun: '06',
  Jul: '07',
  Agu: '08',
  Aug: '08',
  Sep: '09',
  Okt: '10',
  Oct: '10',
  Nov: '11',
  Des: '12',
  Dec: '12',
}
const toIso = (d: string) => {
  const parts = d.split(' ')
  if (parts.length === 3) {
    const [dd, m, y] = parts
    return `${y}-${MONTHS[m] || '11'}-${dd.padStart(2, '0')}`
  }
  return todayIso()
}

const raw: Omit<Report, 'iso'>[] = [
  { id: 2055, street: 'Jl. Jend. Sudirman', x: 62, y: 38, lat: -6.2088, lon: 106.8227, severity: 'BERAT', status: 'BARU', confidence: 0.89, kind: 'pothole', hidden: false, date: '16 Nov 2026', img: img('photo-1515162816999-a0c47dc192f7') },
  { id: 2054, street: 'Jl. Gatot Subroto', x: 44, y: 52, lat: -6.2305, lon: 106.8246, severity: 'SEDANG', status: 'DIVERIFIKASI', confidence: 0.77, kind: 'pothole', hidden: false, date: '16 Nov 2026', img: img('photo-1584463699037-b9ea14a8cf85') },
  { id: 2053, street: 'Jl. Rasuna Said', x: 71, y: 61, lat: -6.2215, lon: 106.8315, severity: 'RINGAN', status: 'PENDING_REVIEW', confidence: 0.48, kind: 'crack', hidden: false, date: '15 Nov 2026', img: img('photo-1597484662317-9bd7bdda2907') },
  { id: 2052, street: 'Jl. MH Thamrin', x: 53, y: 27, lat: -6.1925, lon: 106.8236, severity: 'BERAT', status: 'DALAM_PENANGANAN', confidence: 0.93, kind: 'pothole', hidden: false, date: '15 Nov 2026', img: img('photo-1515162816999-a0c47dc192f7') },
  { id: 2051, street: 'Jl. Casablanca', x: 80, y: 47, lat: -6.2235, lon: 106.8450, severity: 'RINGAN', status: 'SELESAI', confidence: 0.71, kind: 'crack', hidden: false, date: '14 Nov 2026', img: img('photo-1597484662317-9bd7bdda2907') },
  { id: 2050, street: 'Jl. Tebet Raya', x: 78, y: 78, lat: -6.2355, lon: 106.8520, severity: 'SEDANG', status: 'PENDING_REVIEW', confidence: 0.52, kind: 'pothole', hidden: false, date: '14 Nov 2026', img: img('photo-1584463699037-b9ea14a8cf85') },
  { id: 2049, street: 'Jl. Fatmawati', x: 24, y: 72, lat: -6.2810, lon: 106.7970, severity: 'BERAT', status: 'BARU', confidence: 0.84, kind: 'pothole', hidden: false, date: '13 Nov 2026', img: img('photo-1515162816999-a0c47dc192f7') },
  { id: 2048, street: 'Jl. Kebayoran Lama', x: 17, y: 50, lat: -6.2420, lon: 106.7810, severity: 'SEDANG', status: 'DIVERIFIKASI', confidence: 0.69, kind: 'crack', hidden: false, date: '13 Nov 2026', img: img('photo-1597484662317-9bd7bdda2907') },
  { id: 2047, street: 'Jl. Kuningan Barat', x: 58, y: 70, lat: -6.2390, lon: 106.8320, severity: 'RINGAN', status: 'PENDING_REVIEW', confidence: 0.38, kind: 'crack', hidden: false, date: '12 Nov 2026', img: img('photo-1597484662317-9bd7bdda2907') },
  { id: 2046, street: 'Jl. Panglima Polim', x: 36, y: 36, lat: -6.2550, lon: 106.7980, severity: 'SEDANG', status: 'BARU', confidence: 0.81, kind: 'pothole', hidden: false, date: '12 Nov 2026', img: img('photo-1584463699037-b9ea14a8cf85') },
]

export const initialReports: Report[] = raw.map((r) => ({ ...r, iso: toIso(r.date) }))

export type Role = 'petugas' | 'admin'
export interface User { id: number; username: string; password: string; fullName: string; role: Role; active: boolean }
export interface Settings { min: number; publish: number; radius: number }
export interface LogEntry { id: number; actor: string; action: string; target: string; details: string; at: string }

export const initialUsers: User[] = [
  { id: 1, username: 'admin', password: 'admin123', fullName: 'Andi Daniel', role: 'admin', active: true },
  { id: 2, username: 'daniel', password: 'petugas123', fullName: 'Daniel', role: 'petugas', active: true },
  { id: 3, username: 'niyel', password: 'petugas123', fullName: 'Niyel', role: 'petugas', active: true },
]
export const initialSettings: Settings = { min: 0.25, publish: 0.65, radius: 500 }
export const initialLogs: LogEntry[] = [
  { id: 3, actor: 'admin', action: 'UPDATE_SETTING', target: 'system_settings', details: 'confidence_threshold_publish = 0.65', at: '16 Nov 2026 08:12' },
  { id: 2, actor: 'admin', action: 'CREATE_USER', target: 'users', details: 'Akun petugas02 dibuat', at: '15 Nov 2026 14:03' },
  { id: 1, actor: 'petugas01', action: 'STATUS_CHANGE', target: 'reports #2054', details: 'BARU -> DIVERIFIKASI', at: '15 Nov 2026 10:41' },
]
export const nowStamp = () => new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
export const todayIso = () => new Date().toISOString().slice(0, 10)
