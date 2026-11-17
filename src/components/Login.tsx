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
      const authenticatedUser: User = {
        id: data.user_id || 1,
        username: data.username,
        password: '',
        fullName: data.full_name,
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

  const demo = [
    ['Admin Dinas', 'admin', 'admin123'],
    ['Petugas Lapangan', 'petugas01', 'petugas123'],
  ]

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
          <div className="mt-6 rounded-2xl border border-line bg-white p-4 text-sm">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Akun demo resmi (klik untuk mengisi)
            </div>
            {demo.map(([r, a, b]) => (
              <button
                type="button"
                key={a}
                onClick={() => {
                  setU(a)
                  setP(b)
                  setErr('')
                }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-soft"
              >
                <span className="font-medium">{r}</span>
                <span className="font-mono text-xs text-slate-500">{a} / {b}</span>
              </button>
            ))}
          </div>
        </form>
      </div>
      <div className="relative hidden lg:block">
        <MapView reports={reports} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-10 left-10 right-10 rounded-3xl border border-white/70 bg-white/75 p-6 backdrop-blur-xl pointer-events-none">
          <div className="font-display text-3xl font-extrabold">Verifikasi, tangani, rekap.</div>
          <p className="mt-1 text-slate-600">
            Satu platform terintegrasi untuk seluruh siklus perbaikan jalan daerah.
          </p>
        </div>
      </div>
    </div>
  )
}
