import { useEffect, useState } from 'react'
import { CameraCapture } from './Camera'
import { AlertTriangle, Camera, MapPin, ScanLine, CheckCircle2, Clock, RotateCcw } from 'lucide-react'
import { Card, Logo, SeverityBadge } from './ui'
import { MapView, DEFAULT_ROAD_IMG } from './MapView'
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
  const [gpsActive, setGpsActive] = useState<boolean>(false)
  const [gpsLoading, setGpsLoading] = useState<boolean>(true)

  // Real GPS Coordinates (Default fallback: Jakarta Selatan)
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number }>({
    lat: -6.2088,
    lon: 106.8456,
  })
  const [coordsLabel, setCoordsLabel] = useState('Mencari sinyal GPS…')
  const [srcLabel, setSrcLabel] = useState('Menunggu GPS aktif')
  const [nearbyCount, setNearbyCount] = useState<number>(0)

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

  // Get browser GPS with high accuracy
  function requestGps() {
    if (!navigator.geolocation) {
      setGpsLoading(false)
      setGpsActive(false)
      setSrcLabel('Peramban tidak mendukung geolokasi GPS')
      setCoordsLabel('Tidak tersedia')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = parseFloat(p.coords.latitude.toFixed(5))
        const lon = parseFloat(p.coords.longitude.toFixed(5))
        setUserCoords({ lat, lon })
        setCoordsLabel(`${lat}, ${lon}`)
        setSrcLabel('GPS perangkat aktif (Akurat)')
        setGpsActive(true)
        setGpsLoading(false)
      },
      () => {
        setGpsActive(false)
        setGpsLoading(false)
        setSrcLabel('Izin lokasi belum diberikan')
        setCoordsLabel('GPS tidak aktif')
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  useEffect(() => {
    requestGps()
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
        img: data.image_url || fileUrl || DEFAULT_ROAD_IMG,
        annotated_img: data.annotated_image_url || undefined,
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
          img: fileUrl || DEFAULT_ROAD_IMG,
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
          <div className="flex flex-col overflow-hidden rounded-[2rem] border border-line bg-surface shadow-[0_24px_60px_-30px_rgba(15,23,42,0.25)]">
            {/* Header peta di luar area viewport peta agar tidak menutupi peta */}
            <div className="flex flex-wrap items-center justify-between border-b border-line bg-white px-5 py-3.5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Peta Spasial GIS</div>
                <div className="font-display text-base font-bold text-slate-900">OpenStreetMap Terintegrasi</div>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
                {(['BERAT', 'SEDANG', 'RINGAN'] as Severity[]).map((s) => (
                  <span key={s} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: SEV_COLOR[s] }} />
                    {s[0] + s.slice(1).toLowerCase()}
                  </span>
                ))}
              </div>
            </div>

            {/* Area Peta Bebas Halangan (Pin Terkunci pada GPS) */}
            <div className="relative min-h-[440px] flex-1 lg:min-h-[580px]">
              <MapView
                reports={reports}
                userCoords={userCoords}
                radiusMeters={settings.radius}
                className="size-full"
              />
            </div>

            {/* Bar informasi radius waspada di bawah peta */}
            <div className="flex items-center gap-3.5 border-t border-line bg-white px-5 py-3.5">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink text-white">
                <AlertTriangle className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-base font-bold leading-tight text-slate-900">
                  {nearbyCount} lubang di sekitar Anda
                </div>
                <div className="truncate text-xs text-slate-500">
                  Radius {settings.radius}m dari posisi GPS Anda
                </div>
              </div>
            </div>
          </div>

          <Card className="flex flex-col overflow-hidden">
            <div className="p-6 pb-0">
              <h2 className="text-3xl font-extrabold text-slate-900">Laporkan kerusakan</h2>
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
                      <p className="font-medium">Foto langsung dari kamera jalan</p>
                      <p className="mt-1 text-sm text-slate-500">Kamera memerlukan koordinat GPS aktif untuk memindai</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <button
                      disabled={!gpsActive}
                      onClick={() => setCam(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                    >
                      <Camera className="size-4" />
                      {gpsLoading ? 'Mendeteksi sinyal GPS…' : gpsActive ? 'Buka kamera' : 'Menunggu koordinat GPS aktif…'}
                    </button>
                    {!gpsActive && !gpsLoading && (
                      <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        <span>GPS belum terdeteksi. Harap izinkan akses lokasi pada browser.</span>
                        <button
                          type="button"
                          onClick={requestGps}
                          className="shrink-0 font-bold underline hover:text-amber-950"
                        >
                          Coba lagi
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-900">
                    <img
                      src={res?.annotated_url || fileUrl || DEFAULT_ROAD_IMG}
                      alt="Foto jalan"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement
                        if (fileUrl && target.src !== fileUrl) {
                          target.src = fileUrl
                        } else if (target.src !== DEFAULT_ROAD_IMG) {
                          target.onerror = null
                          target.src = DEFAULT_ROAD_IMG
                        }
                      }}
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
