import { useEffect, useRef, useState } from 'react'
import { Camera as CamIcon, RefreshCw, X } from 'lucide-react'

// Kamera langsung: tanpa unggah galeri. Jika izin kamera tidak tersedia, fallback ke kamera perangkat (capture).
export function CameraCapture({ onCapture, onCancel }: { onCapture: (url: string, blob?: Blob) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const fallback = useRef<HTMLInputElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [state, setState] = useState<'starting' | 'live' | 'error'>('starting')

  useEffect(() => {
    let alive = true
    if (!navigator.mediaDevices?.getUserMedia) { setState('error'); return }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}) }
        setState('live')
      })
      .catch(() => alive && setState('error'))
    return () => { alive = false; stream.current?.getTracks().forEach((t) => t.stop()) }
  }, [])

  function snap() {
    const v = video.current
    if (!v) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    c.toBlob((b) => b && onCapture(URL.createObjectURL(b), b), 'image/jpeg', 0.9)
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-900">
        <video ref={video} playsInline muted className="size-full object-cover" />
        {state === 'live' && <div className="pointer-events-none absolute inset-6 rounded-xl border border-white/40" />}
        {state !== 'live' && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-slate-300">
            {state === 'starting' ? 'Membuka kamera…' : 'Kamera tidak dapat diakses langsung. Izinkan akses kamera di peramban, atau gunakan kamera perangkat.'}
          </div>
        )}
        <button onClick={onCancel} aria-label="Tutup kamera" className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur"><X className="size-4" /></button>
      </div>
      {state === 'live' ? (
        <button onClick={snap} className="flex items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-sm font-semibold text-white hover:bg-slate-800"><CamIcon className="size-4" />Ambil foto</button>
      ) : state === 'error' ? (
        <button onClick={() => fallback.current?.click()} className="flex items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-sm font-semibold text-white hover:bg-slate-800"><RefreshCw className="size-4" />Buka kamera perangkat</button>
      ) : null}
      <input ref={fallback} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onCapture(URL.createObjectURL(f), f) }} />
    </div>
  )
}
