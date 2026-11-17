import { useMemo, useState } from 'react'
import { Download, EyeOff, FileText, Printer, X } from 'lucide-react'
import { Card, SeverityBadge, StatusBadge } from './ui'
import { STATUS_LABEL, todayIso, type Report, type Status } from '../data'
import { getPdfDownloadUrl, updateReportStatusApi } from '../api'

const STATUSES: Status[] = ['BARU', 'DIVERIFIKASI', 'DALAM_PENANGANAN', 'SELESAI']

export function ReportTable({ rows, onOpen }: { rows: Report[]; onOpen: (r: Report) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-[11px] uppercase tracking-widest text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Laporan</th>
            <th className="px-3 font-semibold">Keparahan</th>
            <th className="px-3 font-semibold">Keyakinan</th>
            <th className="px-3 font-semibold">Status</th>
            <th className="px-5" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-14 text-center text-slate-500">
                Tidak ada laporan di daftar ini.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line transition hover:bg-soft/60">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <img
                    src={r.annotated_img || r.img}
                    alt=""
                    className="size-12 rounded-xl bg-soft object-cover"
                  />
                  <div>
                    <div className="font-semibold">{r.street}</div>
                    <div className="text-xs text-slate-500">#{r.id} · {r.date}</div>
                  </div>
                </div>
              </td>
              <td className="px-3">
                <SeverityBadge s={r.severity} />
              </td>
              <td className="px-3 font-display font-bold">
                {Math.round(r.confidence * 100)}%
              </td>
              <td className="px-3">
                <StatusBadge s={r.status} />
              </td>
              <td className="px-5 text-right">
                <button
                  onClick={() => onOpen(r)}
                  className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold hover:bg-ink hover:text-white"
                >
                  {r.status === 'SELESAI' ? 'Info' : 'Ubah'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function EditModal({
  report,
  onClose,
  onSave,
}: {
  report: Report
  onClose: () => void
  onSave: (id: number, patch: Partial<Report>, from: Status, hide: boolean) => void
}) {
  const [status, setStatus] = useState<Status>(
    report.status === 'PENDING_REVIEW' ? 'BARU' : report.status
  )
  const [notes, setNotes] = useState(report.notes ?? '')
  const [hide, setHide] = useState(false)
  const [saving, setSaving] = useState(false)
  const locked = report.status === 'SELESAI'

  async function handleSave() {
    setSaving(true)
    try {
      // Sinkronisasi status ke backend FastAPI & Supabase
      await updateReportStatusApi(report.id, hide ? report.status : status, notes, hide)
    } catch (e) {
      console.warn('API sync failed, using local update:', e)
    } finally {
      onSave(report.id, hide ? { hidden: true, notes } : { status, notes }, report.status, hide)
      setSaving(false)
    }
  }

  return (
    <div
      className="no-print fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rise w-full max-w-md rounded-3xl border border-white/60 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Laporan #{report.id}
            </div>
            <h3 className="text-2xl font-extrabold">{report.street}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="grid size-9 place-items-center rounded-full bg-soft"
          >
            <X className="size-4" />
          </button>
        </div>
        <img
          src={report.annotated_img || report.img}
          alt=""
          className="mt-4 h-44 w-full rounded-2xl bg-soft object-cover"
        />
        <label className="mt-4 block text-sm font-medium">
          Status penanganan
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            disabled={hide || locked}
            className="mt-1.5 w-full rounded-xl border border-line bg-soft px-3 py-2.5 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-medium">
          Catatan teknis perbaikan
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={locked}
            rows={3}
            placeholder="Mis. armada tambal aspal cold-mix siap di lokasi"
            className="mt-1.5 w-full resize-none rounded-xl border border-line bg-soft px-3 py-2.5 text-sm"
          />
        </label>
        {!locked && (
          <label className="mt-3 flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={hide}
              onChange={(e) => setHide(e.target.checked)}
              className="size-4 accent-slate-900"
            />
            <EyeOff className="size-4 text-slate-500" />
            Sembunyikan laporan ini (false positive)
          </label>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:bg-soft"
          >
            {locked ? 'Tutup' : 'Batal'}
          </button>
          {!locked && (
            <button
              disabled={saving}
              onClick={handleSave}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? 'Menyimpan…' : 'Simpan progres'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function RekapPage({ reports }: { reports: Report[] }) {
  const isos = reports.map((r) => r.iso).sort()
  const [from, setFrom] = useState(isos[0] ?? todayIso())
  const [to, setTo] = useState(todayIso() > (isos.at(-1) ?? '') ? todayIso() : isos.at(-1)!)
  const [st, setSt] = useState<'ALL' | Status>('ALL')

  const rows = useMemo(
    () =>
      reports.filter(
        (r) =>
          !r.hidden &&
          r.iso >= from &&
          r.iso <= to &&
          (st === 'ALL' || r.status === st)
      ),
    [reports, from, to, st]
  )

  function csv() {
    const head = 'ID,Jalan,Keparahan,Status,Keyakinan,Tanggal\n'
    const body = rows
      .map((r) => `${r.id},"${r.street}",${r.severity},${r.status},${r.confidence},${r.iso}`)
      .join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([head + body], { type: 'text/csv' }))
    a.download = `rekap-potholescan-${from}_${to}.csv`
    a.click()
  }

  function downloadOfficialPdf() {
    const url = getPdfDownloadUrl(from, to, st)
    window.open(url, '_blank')
  }

  const field = 'mt-1.5 rounded-xl border border-line bg-soft px-3 py-2.5 text-sm'

  return (
    <div className="space-y-4">
      <Card className="no-print flex flex-wrap items-end gap-4 p-5">
        <label className="text-sm font-medium">
          Dari
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={`${field} block`}
          />
        </label>
        <label className="text-sm font-medium">
          Sampai
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={`${field} block`}
          />
        </label>
        <label className="text-sm font-medium">
          Status
          <select
            value={st}
            onChange={(e) => setSt(e.target.value as 'ALL' | Status)}
            className={`${field} block`}
          >
            <option value="ALL">Semua</option>
            {(['PENDING_REVIEW', ...STATUSES] as Status[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={csv}
            className="flex items-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold hover:bg-soft"
          >
            <Download className="size-4" /> CSV
          </button>
          <button
            onClick={downloadOfficialPdf}
            className="flex items-center gap-2 rounded-full border border-ink bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-soft"
          >
            <FileText className="size-4" /> Unduh PDF Resmi Dinas
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Printer className="size-4" /> Cetak Halaman
          </button>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="flex items-end justify-between border-b border-line p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Rekapitulasi resmi
            </div>
            <h3 className="text-2xl font-extrabold">
              {from} s/d {to}
            </h3>
          </div>
          <div className="text-right">
            <div className="font-display text-5xl font-extrabold leading-none">
              {rows.length}
            </div>
            <div className="text-xs text-slate-500">laporan</div>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-widest text-slate-400">
            <tr>
              <th className="px-5 py-3">ID</th>
              <th>Lokasi</th>
              <th>Keparahan</th>
              <th>Status</th>
              <th className="pr-5 text-right">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                  Tidak ada data pada rentang ini.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-5 py-3 font-medium">#{r.id}</td>
                <td>{r.street}</td>
                <td>
                  <SeverityBadge s={r.severity} />
                </td>
                <td>
                  <StatusBadge s={r.status} />
                </td>
                <td className="pr-5 text-right text-slate-500">{r.iso}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
