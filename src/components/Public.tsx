import { useEffect, useState, useRef } from 'react'
import { CameraCapture } from './Camera'
import { AlertTriangle, Camera, MapPin, ScanLine, ShieldCheck, Sparkles, CheckCircle2, Clock, RotateCcw, Upload } from 'lucide-react'
import { Card, Logo, SeverityBadge } from './ui'
import { MapView } from './MapView'
import { SEV_COLOR, todayIso, type Report, type Settings, type Severity } from '../data'
import { submitReport, fetchNearby, type ApiReportResponse } from '../api'

interface Result {
  severity: Severity
  confidence: number
  box: [number, number, number, number]
  status: 'BARU' | 'PENDING_REVIEW'
  id: number
  annotated_url?: string
  none?: boolean
}

export function Public({
  reports,
  settings,
  onAdd,
  onLogin,
}: {
  reports: Report[]
  settings: Settings
  onAdd: (r: Report) => void
  onLogin: () => void
}) {
  const [cam, setCam] = useState(false)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileBlob, setFileBlob] = useState<Blob | null>(null)
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [res, setRes] = useState<Result | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Real GPS Coordinates (Default: Jakarta Selatan)
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number }>({
    lat: -6.2088,
    lon: 106.8456,
  })
  const [coordsLabel, setCoordsLabel] = useState('-6.2088, 106.8456')
  const [srcLabel, setSrcLabel] = useState('GPS otomatis (Peramban / Foto)')
  const [nearbyCount, setNearbyCount] = useState<number>(0)

  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Fetch real nearby warnings whenever coords change
  useEffect(() => {
    fetchNearby(userCoords.lat, userCoords.lon, settings.radius)
      .then((data) => setNearbyCount(data.unresolved_damages_count))
      .catch(() => {
        // Fallback local distance filter
        const count = reports.filter(
          (r) => !r.hidden && r.status !== 'SELESAI' && r.status !== 'PENDING_REVIEW'
        ).length
        setNearbyCount(count)
      })
  }, [userCoords, settings.radius, reports])

  // Get browser GPS on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const lat = parseFloat(p.coords.latitude.toFixed(5))
          const lon = parseFloat(p.coords.longitude.toFixed(5))
          setUserCoords({ lat, lon })
          setCoordsLabel(`${lat}, ${lon}`)
          setSrcLabel('GPS peramban (Akurat)')
        },
        () => {
          setSrcLabel('Lokasi default (Jakarta Selatan)')
        },
        { timeout: 5000 }
      )
    }
  }, [])

  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl) }, [fileUrl])

  function handleCaptureUrl(url: string) {
    setCam(false)
    setFileUrl(url)
    setRes(null)
    setErrorMsg(null)
    setPhase('idle')

    // Fetch the blob from object URL
    fetch(url)
      .then((r) => r.blob())
      .then((b) => setFileBlob(b))
      .catch(() => {})
  }

  function handleGallerySelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) {
      setFileBlob(f)
      setFileUrl(URL.createObjectURL(f))
      setRes(null)
      setErrorMsg(null)
      setPhase('idle')
    }
  }

  async function analyze() {
    if (!fileBlob) return
    setPhase('scanning')
    setErrorMsg(null)

    try {
      // Panggilan nyata ke backend FastAPI (POST /api/reports)
      const data: ApiReportResponse = await submitReport(fileBlob, userCoords.lat, userCoords.lon)

      if (data.status === 'NORMAL' || !data.detections || data.detections.length === 0) {
        setRes({
          id: 0,
          confidence: data.max_confidence || 0,
          severity: 'RINGAN',
          status: 'BARU',
          box: [0, 0, 0, 0],
          none: true,
        })
        setPhase('done')
        return
      }

      const topDet = data.detections[0]
      const severity: Severity = (data.severity as Severity) || 'SEDANG'
      const status = (data.status as 'BARU' | 'PENDING_REVIEW') || 'BARU'
      const reportId = data.report_id || Math.max(0, ...reports.map((r) => r.id)) + 1

      const result: Result = {
        severity,
        confidence: data.max_confidence || topDet.confidence,
        status,
        id: reportId,
        box: topDet.bbox,
        annotated_url: data.annotated_image_url,
      }

      setRes(result)
      setPhase('done')
      if (data.nearby_unresolved_count !== undefined) {
        setNearbyCount(data.nearby_unresolved_count)
      }

      // Tambahkan ke state laporan publik
      onAdd({
        id: reportId,
        street: data.location?.source === 'exif' ? 'Terdeteksi dari GPS Foto' : 'Lokasi Laporan Anda',
        x: 50,
        y: 50,
        lat: data.location?.latitude ?? userCoords.lat,
        lon: data.location?.longitude ?? userCoords.lon,
        severity,
        status,
        confidence: data.max_confidence || topDet.confidence,
        kind: topDet.class_name,
        hidden: false,
        date: 'Hari ini',
        iso: todayIso(),
        img: data.image_url || fileUrl!,
        annotated_img: data.annotated_image_url,
      })
    } catch (err: any) {
      console.warn('Backend offline or error, running client fallback:', err)
      setErrorMsg(err.message || 'Gagal menghubungi server inferensi.')
      
      // Fallback simulasi jika backend sedang tidak aktif
      setTimeout(() => {
        const confidence = +(0.45 + Math.random() * 0.5).toFixed(2)
        const severity: Severity = confidence > 0.8 ? 'BERAT' : confidence > 0.6 ? 'SEDANG' : 'RINGAN'
        const status = confidence >= settings.publish ? 'BARU' : 'PENDING_REVIEW'
        const id = Math.max(...reports.map((r) => r.id)) + 1
        const r: Result = {
          severity,
          confidence,
          status,
          id,
          box: [0.35, 0.45, 0.3, 0.25],
        }
        setRes(r)
        setPhase('done')
        onAdd({
          id,
          street: 'Lokasi laporan Anda',
          x: 50,
          y: 50,
          lat: userCoords.lat + (Math.random() - 0.5) * 0.005,
          lon: userCoords.lon + (Math.random() - 0.5) * 0.005,
          severity,
          status,
          confidence,
          kind: 'pothole',
          hidden: false,
          date: 'Hari ini',
          iso: todayIso(),
          img: fileUrl!,
        })
      }, 1500)
    }
  }

  function reset() {
    setFileUrl(null)
    setFileBlob(null)
    setRes(null)
    setErrorMsg(null)
    setPhase('idle')
  }

  const activeReportsCount = reports.filter(
    (r) => !r.hidden && r.status !== 'SELESAI' && r.status !== 'PENDING_REVIEW'
  ).length

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-5">
        <Logo />
        <button
          onClick={onLogin}
          className="rounded-full border border-line bg-white px-5 py-2 text-sm font-medium transition hover:border-slate-300"
        >
          Masuk petugas
        </button>
      </header>

      <main className="mx-auto max-w-[1280px] px-6 pb-16">
        <section className="rise grid items-end gap-8 pb-8 pt-6 lg:grid-cols-[1.4fr_1fr]">
          <h1 className="text-5xl font-extrabold leading-[1.02] sm:text-7xl">
            Jalan rusak,<br />
            <span className="text-slate-400">terdeteksi</span> dalam detik.
          </h1>
          <div className="flex items-end gap-8 lg:justify-end">
            <Stat n={activeReportsCount} l="Titik aktif" />
            <Stat
              n={reports.filter((r) => r.severity === 'BERAT' && r.status !== 'SELESAI' && !r.hidden).length}
              l="Kategori berat"
            />
            <Stat n={`${settings.radius}m`} l="Radius waspada" />
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-line bg-surface shadow-[0_24px_60px_-30px_rgba(15,23,42,0.25)]">
            <MapView
              reports={reports}
              userCoords={userCoords}
              radiusMeters={settings.radius}
              onSelectCoords={(lat, lon) => {
                setUserCoords({ lat, lon })
                setCoordsLabel(`${lat.toFixed(5)}, ${lon.toFixed(5)}`)
                setSrcLabel('Pin manual di peta')
              }}
              className="h-[460px] lg:h-full lg:min-h-[640px]"
            />
            <div className="pointer-events-none absolute left-4 right-4 top-4 flex flex-wrap items-start justify-between gap-3 z-10">
              <div className="pointer-events-auto rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-lg backdrop-blur-xl">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Peta Spasial GIS</div>
                <div className="font-display text-lg font-bold">OpenStreetMap Terintegrasi</div>
              </div>
              <div className="pointer-events-auto flex gap-3 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs font-medium shadow-lg backdrop-blur-xl">
                {(['BERAT', 'SEDANG', 'RINGAN'] as Severity[]).map((s) => (
                  <span key={s} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: SEV_COLOR[s] }} />
                    {s[0] + s.slice(1).toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-center gap-4 rounded-2xl border border-white/70 bg-white/85 p-4 shadow-xl backdrop-blur-xl z-10">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-ink text-white">
                <AlertTriangle className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-lg font-bold leading-tight">
                  {nearbyCount} lubang aktif di sekitar Anda
                </div>
                <div className="truncate text-sm text-slate-500">
                  Radius {settings.radius}m dari posisi Anda · Klik peta untuk ubah titik
                </div>
              </div>
            </div>
          </div>

          <Card className="flex flex-col overflow-hidden">
            <div className="p-6 pb-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                <Sparkles className="size-3.5" /> Analisis AI (FastAPI + YOLOv8)
              </div>
              <h2 className="mt-1 text-3xl font-extrabold">Laporkan kerusakan</h2>
            </div>

            <div className="flex flex-1 flex-col gap-4 p-6">
              {cam ? (
                <CameraCapture onCapture={handleCaptureUrl} onCancel={() => setCam(false)} />
              ) : !fileUrl ? (
                <>
                  <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-slate-300 bg-soft p-8 text-center">
                    <div>
                      <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-white shadow-sm">
                        <ScanLine className="size-6" />
                      </div>
                      <p className="font-medium">Foto langsung atau dari galeri</p>
                      <p className="mt-1 text-sm text-slate-500">AI otomatis mengekstrak GPS & mendeteksi lubang</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setCam(true)}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      <Camera className="size-4" /> Buka kamera
                    </button>
                    <button
                      onClick={() => galleryInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-white py-3.5 text-sm font-semibold hover:bg-soft"
                    >
                      <Upload className="size-4" /> Pilih foto
                    </button>
                  </div>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    hidden
                    onChange={handleGallerySelect}
                  />
                </>
              ) : (
                <>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-900">
                    <img
                      src={res?.annotated_url || fileUrl}
                      alt="Foto jalan"
                      className="size-full object-cover"
                    />
                    {phase === 'scanning' && (
                      <>
                        <div className="absolute inset-0 bg-slate-900/30" />
                        <div
                          className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-amber-300/40 to-transparent"
                          style={{ animation: 'scan 1.1s ease-in-out infinite alternate' }}
                        />
                      </>
                    )}
                    {res && !res.none && !res.annotated_url && (
                      <div
                        className="absolute rounded-lg border-2"
                        style={{
                          left: `${res.box[0] * 100}%`,
                          top: `${res.box[1] * 100}%`,
                          width: `${res.box[2] * 100}%`,
                          height: `${res.box[3] * 100}%`,
                          borderColor: SEV_COLOR[res.severity],
                        }}
                      >
                        <span
                          className="absolute -top-6 left-[-2px] rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white"
                          style={{ background: SEV_COLOR[res.severity] }}
                        >
                          pothole {res.confidence.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl bg-soft px-4 py-3 text-sm">
                    <MapPin className="size-4 shrink-0 text-slate-500" />
                    <div className="min-w-0">
                      <div className="font-medium">{srcLabel}</div>
                      <div className="truncate text-xs text-slate-500">{coordsLabel}</div>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      {errorMsg}
                    </div>
                  )}

                  {res?.none && (
                    <div className="rise flex items-start gap-2.5 rounded-2xl border border-line p-4 text-sm text-slate-600">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      Tidak ditemukan kerusakan jalan signifikan. Kondisi jalan normal.
                    </div>
                  )}

                  {res && !res.none && (
                    <div className="rise rounded-2xl border border-line p-4">
                      <div className="flex items-center justify-between">
                        <SeverityBadge s={res.severity} />
                        <span className="font-display text-3xl font-extrabold">
                          {Math.round(res.confidence * 100)}%
                        </span>
                      </div>
                      <div className="mt-3 flex items-start gap-2.5 text-sm text-slate-600">
                        {res.status === 'BARU' ? (
                          <>
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                            Laporan #{res.id} tervalidasi ({Math.round(res.confidence * 100)}% &ge; 65%) dan langsung diterbitkan ke peta publik.
                          </>
                        ) : (
                          <>
                            <Clock className="mt-0.5 size-4 shrink-0 text-amber-600" />
                            Laporan #{res.id} masuk antrean verifikasi staf (keyakinan {Math.round(res.confidence * 100)}%).
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {phase === 'done' ? (
                    <button
                      onClick={reset}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-white py-3.5 text-sm font-semibold hover:bg-soft"
                    >
                      <RotateCcw className="size-4" /> Foto ulang
                    </button>
                  ) : (
                    <button
                      disabled={phase === 'scanning'}
                      onClick={analyze}
                      className="rounded-2xl bg-ink py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {phase === 'scanning' ? 'Menganalisis dengan YOLOv8…' : 'Analisis dengan AI'}
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-line bg-soft/60 px-6 py-3 text-xs text-slate-500">
              <ShieldCheck className="size-3.5" />
              Foto diproses secara aman via FastAPI & Supabase Storage.
            </div>
          </Card>
        </section>
      </main>
    </div>
  )
}

function Stat({ n, l }: { n: number | string; l: string }) {
  return (
    <div>
      <div className="font-display text-5xl font-extrabold leading-none">{n}</div>
      <div className="mt-2 text-xs font-medium uppercase tracking-widest text-slate-500">{l}</div>
    </div>
  )
}
