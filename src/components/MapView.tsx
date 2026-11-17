import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import { SEV_COLOR, type Report } from '../data'

// Fix default Leaflet icon paths in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export const DEFAULT_ROAD_IMG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="%23f1f5f9" stroke="%2394a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="4" fill="%23f1f5f9"/><path d="M12 2v20" stroke="%23cbd5e1" stroke-dasharray="2 2"/><path d="M4 19l4-4 3 3 5-5 4 4" stroke="%23e5484d" stroke-width="2"/><circle cx="16" cy="13" r="2" fill="%23e5484d"/></svg>'

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
  const prevCenterRef = useRef<[number, number]>(center)

  useEffect(() => {
    const [prevLat, prevLon] = prevCenterRef.current
    if (prevLat !== center[0] || prevLon !== center[1]) {
      prevCenterRef.current = center
      map.setView(center, map.getZoom())
    }
  }, [center, map])
  return null
}

interface MapViewProps {
  reports: Report[]
  className?: string
  userCoords?: { lat: number; lon: number }
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
                        (e.currentTarget as HTMLImageElement).src = DEFAULT_ROAD_IMG
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
