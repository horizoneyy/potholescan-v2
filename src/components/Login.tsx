import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Logo } from './ui'
import { MapView } from './MapView'
import type { Report, User } from '../data'
import { loginApi } from '../api'

export function Login({
  reports,
  users,
  onBack,
  onSuccess,
}: {
  reports: Report[]
  users: User[]
  onBack: () => void
  onSuccess: (u: User) => void
}) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!u.trim() || !p) return setErr('Harap isi username dan kata sandi.')

    setLoading(true)
    setErr('')

    try {
      // 1. Autentikasi riil ke backend FastAPI (POST /api/auth/login)
      const data = await loginApi(u.trim(), p)
      const matchedLocal = users.find((x) => x.username.toLowerCase() === data.username.toLowerCase())
      const authenticatedUser: User = {
        id: data.user_id || matchedLocal?.id || (data.role === 'admin' ? 1 : 2),
        username: data.username,
        password: '',
        fullName: data.full_name || matchedLocal?.fullName || (data.role === 'admin' ? 'Andi Daniel' : data.username),
        role: data.role,
        active: true,
      }
      onSuccess(authenticatedUser)
    } catch (apiErr: any) {
      // 2. Fallback jika backend offline / lokal demo
      const found = users.find((x) => x.username === u.trim() && x.password === p)
      if (found) {
        if (!found.active) {
          setLoading(false)
          return setErr('Akun ini dinonaktifkan. Hubungi administrator.')
        }
        onSuccess(found)
        return
      }
      setErr(apiErr.message || 'Username atau kata sandi salah.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col p-8 sm:p-12">
        <button
          onClick={onBack}
          className="flex w-fit items-center gap-2 text-sm text-slate-500 hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Kembali ke peta
        </button>
        <form onSubmit={submit} className="rise m-auto w-full max-w-sm">
          <Logo />
          <h1 className="mt-10 text-5xl font-extrabold leading-tight">Masuk ke panel dinas</h1>
          <p className="mt-3 text-slate-500">
            Khusus petugas lapangan PUPR dan administrator.
          </p>
          <label className="mt-8 block text-sm font-medium">
            Username
            <input
              value={u}
              onChange={(e) => {
                setU(e.target.value)
                setErr('')
              }}
              autoComplete="username"
              className="mt-1.5 w-full rounded-2xl border border-line bg-white px-4 py-3"
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Kata sandi
            <input
              type="password"
              value={p}
              onChange={(e) => {
                setP(e.target.value)
                setErr('')
              }}
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-2xl border border-line bg-white px-4 py-3"
            />
          </label>
          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
          <button
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-ink py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? 'Memverifikasi…' : 'Masuk'}
          </button>
        </form>
      </div>
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-50 p-10 lg:flex">
        <MapView reports={reports} className="absolute inset-0 opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/20 to-transparent pointer-events-none" />
        
        {/* Ilustrasi Modern Inspeksi Kerusakan Jalan */}
        <div className="relative z-10 m-auto w-full max-w-lg">
          <RoadInfrastructureIllustration />
        </div>

        <div className="relative z-10 rounded-3xl border border-white/60 bg-white/85 p-6 backdrop-blur-xl shadow-xl">
          <div className="font-display text-3xl font-extrabold text-slate-900">Verifikasi, tangani, rekap.</div>
          <p className="mt-1 text-slate-600">
            Satu platform terintegrasi untuk seluruh siklus perbaikan jalan daerah.
          </p>
        </div>
      </div>
    </div>
  )
}

function RoadInfrastructureIllustration() {
  return (
    <div className="relative mx-auto flex w-full items-center justify-center">
      <svg
        viewBox="0 0 500 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full rounded-3xl border border-white/70 bg-white/80 p-4 shadow-2xl backdrop-blur-md"
      >
        <defs>
          <linearGradient id="roadGrad" x1="250" y1="40" x2="250" y2="280" gradientUnits="userSpaceOnUse">
            <stop stopColor="#334155" />
            <stop offset="1" stopColor="#0f172a" />
          </linearGradient>
          <radialGradient id="pulseRed" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e5484d" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#e5484d" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Grid lines */}
        <line x1="30" y1="70" x2="470" y2="70" stroke="#cbd5e1" strokeDasharray="4 4" />
        <line x1="30" y1="150" x2="470" y2="150" stroke="#cbd5e1" strokeDasharray="4 4" />
        <line x1="30" y1="230" x2="470" y2="230" stroke="#cbd5e1" strokeDasharray="4 4" />

        {/* Road Polygon */}
        <polygon points="190,40 310,40 430,280 70,280" fill="url(#roadGrad)" />

        {/* Road Markings */}
        <line x1="250" y1="45" x2="250" y2="85" stroke="#f59e0b" strokeWidth="4" />
        <line x1="250" y1="115" x2="250" y2="165" stroke="#f59e0b" strokeWidth="5" />
        <line x1="250" y1="195" x2="250" y2="260" stroke="#f59e0b" strokeWidth="6" />

        {/* Road Curbs */}
        <line x1="190" y1="40" x2="70" y2="280" stroke="#94a3b8" strokeWidth="3" />
        <line x1="310" y1="40" x2="430" y2="280" stroke="#94a3b8" strokeWidth="3" />

        {/* Detected Pothole 1 (Heavy - Red) */}
        <ellipse cx="180" cy="210" rx="36" ry="18" fill="url(#pulseRed)" />
        <ellipse cx="180" cy="210" rx="24" ry="12" fill="#020617" />
        <rect x="145" y="185" width="70" height="48" rx="6" fill="none" stroke="#e5484d" strokeWidth="2" strokeDasharray="3 3" />
        <rect x="145" y="168" width="80" height="18" rx="4" fill="#e5484d" />
        <text x="149" y="181" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="sans-serif">POTHOLE 92%</text>

        {/* Detected Crack 2 (Medium - Yellow) */}
        <ellipse cx="320" cy="130" rx="14" ry="7" fill="#020617" />
        <rect x="300" y="115" width="40" height="28" rx="4" fill="none" stroke="#f5a524" strokeWidth="2" />
        <rect x="300" y="103" width="65" height="14" rx="3" fill="#f5a524" />
        <text x="304" y="113" fill="#ffffff" fontSize="8" fontWeight="bold" fontFamily="sans-serif">CRACK 78%</text>

        {/* Radar GIS Circle */}
        <circle cx="180" cy="210" r="54" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.7" strokeDasharray="5 3" />
        <circle cx="180" cy="210" r="3.5" fill="#38bdf8" />

        {/* Top Floating Badge */}
        <g transform="translate(360, 20)">
          <rect width="110" height="30" rx="15" fill="#0f172a" />
          <circle cx="16" cy="15" r="5" fill="#10b981" />
          <text x="28" y="19" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="sans-serif">GPS Terkalibrasi</text>
        </g>
      </svg>
    </div>
  )
}
