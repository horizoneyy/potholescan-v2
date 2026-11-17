import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { SEV_COLOR, type Report } from '../data'

// Fix default Leaflet icon paths in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export const DEFAULT_ROAD_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160" width="100%" height="100%">
  <defs>
    <linearGradient id="roadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="potholeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="240" height="160" fill="url(#roadGrad)"/>
  <polygon points="30,160 85,0 155,0 210,160" fill="#334155" opacity="0.5"/>
  <line x1="30" y1="160" x2="85" y2="0" stroke="#64748b" stroke-width="2.5" stroke-dasharray="8 6"/>
  <line x1="210" y1="160" x2="155" y2="0" stroke="#64748b" stroke-width="2.5" stroke-dasharray="8 6"/>
  <line x1="120" y1="15" x2="120" y2="40" stroke="#fbbf24" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="120" y1="60" x2="120" y2="95" stroke="#fbbf24" stroke-width="4.5" stroke-linecap="round"/>
  <line x1="120" y1="115" x2="120" y2="155" stroke="#fbbf24" stroke-width="5.5" stroke-linecap="round"/>
  <g transform="translate(148, 105)">
    <ellipse cx="0" cy="0" rx="34" ry="18" fill="url(#potholeGrad)" stroke="#ef4444" stroke-width="2" stroke-dasharray="5 3"/>
    <ellipse cx="-2" cy="1" rx="22" ry="11" fill="#020617"/>
    <path d="M-30,-2 L-42,-7 M28,4 L40,10 M-8,-16 L-12,-26 M14,14 L20,24" stroke="#f43f5e" stroke-width="1.8" stroke-linecap="round"/>
    <g transform="translate(0, -22)">
      <path d="M0,0 C-7,0 -12,-5 -12,-12 C-12,-19 0,-30 0,-30 C0,-30 12,-19 12,-12 C12,-5 7,0 0,0 Z" fill="#ef4444"/>
      <circle cx="0" cy="-12" r="4.5" fill="#ffffff"/>
    </g>
  </g>
  <g transform="translate(14, 14)">
    <rect width="96" height="20" rx="10" fill="#0f172a" opacity="0.85" stroke="#334155" stroke-width="1"/>
    <circle cx="10" cy="10" r="4" fill="#38bdf8"/>
    <text x="20" y="14" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="600" letter-spacing="0.5">POTHOLESCAN</text>
  </g>
</svg>`
  )

function createCustomMarkerIcon(color: string, isBerat: boolean, isSelesai: boolean) {
  const pulseHtml = isBerat && !isSelesai
    ? `<span style="position: absolute; inset: -4px; border-radius: 9999px; background: ${color}; animation: pulse-ring 2s ease-out infinite; opacity: 0.75;"></span>`
    : ''

  const html = `
    <div style="position: relative; width: 22px; height: 22px; display: grid; place-items: center;">
      ${pulseHtml}
      <span style="position: relative; display: block; width: 16px; height: 16px; border-radius: 9999px; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); background: ${isSelesai ? '#94a3b8' : color};"></span>
    </div>
  `
  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  })
}

function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom())
  }, [center, map])
  return null
}

interface MapViewProps {
  reports: Report[]
  className?: string
  userCoords?: { lat: number; lon: number }
  userPin?: { x: number; y: number }
  radiusMeters?: number
}

export function MapView({
  reports,
  className = '',
  userCoords,
  radiusMeters = 500,
}: MapViewProps) {
  const defaultCenter: [number, number] = userCoords
    ? [userCoords.lat, userCoords.lon]
    : [-6.2088, 106.8456]

  const activeReports = reports.filter((r) => !r.hidden && r.status !== 'PENDING_REVIEW')

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <MapContainer
        center={defaultCenter}
        zoom={14}
        scrollWheelZoom={false}
        className="size-full z-0"
        style={{ minHeight: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapRecenter center={defaultCenter} />

        {/* User Location & 500m Proximity Circle */}
        {userCoords && (
          <>
            <Circle
              center={[userCoords.lat, userCoords.lon]}
              radius={radiusMeters}
              pathOptions={{
                color: '#38bdf8',
                fillColor: '#38bdf8',
                fillOpacity: 0.12,
                weight: 1.5,
              }}
            />
            <Marker
              position={[userCoords.lat, userCoords.lon]}
              icon={L.divIcon({
                html: `
                  <div style="position: relative; width: 20px; height: 20px; display: grid; place-items: center;">
                    <span style="position: absolute; inset: -4px; border-radius: 9999px; background: #0284c7; animation: pulse-ring 2s ease-out infinite; opacity: 0.5;"></span>
                    <span style="position: relative; display: block; width: 14px; height: 14px; border-radius: 9999px; border: 2.5px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); background: #0284c7;"></span>
                  </div>
                `,
                className: 'user-pin-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              })}
            >
              <Popup>
                <div className="p-1 text-xs">
                  <div className="font-bold text-slate-800">Posisi Anda</div>
                  <div className="text-slate-500">Radius Waspada {radiusMeters}m aktif</div>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Pothole & Crack Report Markers */}
        {activeReports.map((r) => {
          const lat = r.lat ?? -6.2088 + (r.y - 50) * 0.002
          const lon = r.lon ?? 106.8456 + (r.x - 50) * 0.002
          const isBerat = r.severity === 'BERAT'
          const isSelesai = r.status === 'SELESAI'
          const icon = createCustomMarkerIcon(SEV_COLOR[r.severity], isBerat, isSelesai)

          return (
            <Marker key={r.id} position={[lat, lon]} icon={icon}>
              <Popup>
                <div className="min-w-[180px] p-1 font-sans text-xs">
                  <div className="overflow-hidden rounded-xl bg-slate-100">
                    <img
                      src={r.annotated_img || r.img || DEFAULT_ROAD_IMG}
                      alt={r.street}
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement
                        if (r.img && target.src !== r.img && target.src !== DEFAULT_ROAD_IMG) {
                          target.src = r.img
                        } else if (target.src !== DEFAULT_ROAD_IMG) {
                          target.onerror = null
                          target.src = DEFAULT_ROAD_IMG
                        }
                      }}
                      className="h-28 w-full object-cover"
                    />
                  </div>
                  <div className="mt-2 font-bold text-slate-900">{r.street}</div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span
                      className="font-semibold uppercase"
                      style={{ color: SEV_COLOR[r.severity] }}
                    >
                      {r.severity}
                    </span>
                    <span>{Math.round(r.confidence * 100)}% yakin</span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    #{r.id} · {r.date} · Status: {r.status}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
