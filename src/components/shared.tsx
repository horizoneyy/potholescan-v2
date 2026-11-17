import { useMemo, useState } from "react";
import { Download, EyeOff, FileText, Maximize2, Printer, X } from "lucide-react";
import { Card, SeverityBadge, StatusBadge } from "./ui";
import { STATUS_LABEL, todayIso, type Report, type Status } from "../data";
import { getPdfDownloadUrl, getExcelDownloadUrl, updateReportStatusApi } from "../api";
import { DEFAULT_ROAD_IMG } from "./MapView";

const STATUSES: Status[] = ["BARU", "DIVERIFIKASI", "DALAM_PENANGANAN", "SELESAI"];

export function ReportTable({
  rows,
  onOpen,
  readOnly = false,
}: {
  rows: Report[];
  onOpen?: (r: Report) => void;
  readOnly?: boolean;
}) {
  const [preview, setPreview] = useState<Report | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-[11px] uppercase tracking-widest text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Laporan</th>
            <th className="px-3 font-semibold">Keparahan</th>
            <th className="px-3 font-semibold">Keyakinan</th>
            <th className="px-3 font-semibold">Status</th>
            {onOpen ? (
              <th className="px-5 text-right font-semibold">Aksi</th>
            ) : (
              !readOnly && <th className="px-5" />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={onOpen || !readOnly ? 5 : 4}
                className="px-5 py-14 text-center text-slate-500"
              >
                Tidak ada laporan di daftar ini.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line transition hover:bg-soft/60">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => setPreview(r)}
                    title="Klik untuk melihat foto resolusi penuh"
                    className="group relative size-12 shrink-0 cursor-pointer overflow-hidden rounded-xl bg-soft shadow-sm ring-1 ring-black/5 transition hover:ring-2 hover:ring-amber-500"
                  >
                    <img
                      src={r.annotated_img || r.img || DEFAULT_ROAD_IMG}
                      alt=""
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        if (r.img && target.src !== r.img && target.src !== DEFAULT_ROAD_IMG) {
                          target.src = r.img;
                        } else if (target.src !== DEFAULT_ROAD_IMG) {
                          target.onerror = null;
                          target.src = DEFAULT_ROAD_IMG;
                        }
                      }}
                      className="size-full object-cover transition duration-200 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100">
                      <Maximize2 className="size-3.5 text-white" />
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold">{r.street}</div>
                    <div className="text-xs text-slate-500">
                      #{r.id} · {r.date}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3">
                <SeverityBadge s={r.severity} />
              </td>
              <td className="px-3 font-display font-bold">{Math.round(r.confidence * 100)}%</td>
              <td className="px-3">
                <StatusBadge s={r.status} />
              </td>
              {onOpen && (
                <td className="px-5 text-right">
                  <button
                    onClick={() => onOpen(r)}
                    className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold hover:bg-ink hover:text-white"
                  >
                    {readOnly ? "Detail" : r.status === "SELESAI" ? "Info" : "Ubah"}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {preview && <ImagePreviewModal report={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

export function ImagePreviewModal({ report, onClose }: { report: Report; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"annotated" | "original">(
    report.annotated_img ? "annotated" : "original",
  );
  const currentSrc =
    activeTab === "annotated"
      ? report.annotated_img || report.img || DEFAULT_ROAD_IMG
      : report.img || DEFAULT_ROAD_IMG;

  return (
    <div
      className="no-print fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rise w-full max-w-2xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Pratinjau Citra Resolusi Penuh · Laporan #{report.id}
            </div>
            <h3 className="text-xl font-bold text-slate-900">{report.street}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="grid size-9 place-items-center rounded-full bg-soft transition hover:bg-slate-200"
          >
            <X className="size-4" />
          </button>
        </div>

        {report.annotated_img && (
          <div className="flex gap-2 border-b border-line bg-soft/60 px-6 py-2.5">
            <button
              onClick={() => setActiveTab("annotated")}
              className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
                activeTab === "annotated"
                  ? "bg-ink text-white shadow-sm"
                  : "text-slate-600 hover:bg-white"
              }`}
            >
              Foto Deteksi AI (Bounding Box)
            </button>
            <button
              onClick={() => setActiveTab("original")}
              className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
                activeTab === "original"
                  ? "bg-ink text-white shadow-sm"
                  : "text-slate-600 hover:bg-white"
              }`}
            >
              Foto Asli Kamera
            </button>
          </div>
        )}

        <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950">
          <img
            src={currentSrc}
            alt={report.street}
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              if (report.img && target.src !== report.img && target.src !== DEFAULT_ROAD_IMG) {
                target.src = report.img;
              } else if (target.src !== DEFAULT_ROAD_IMG) {
                target.onerror = null;
                target.src = DEFAULT_ROAD_IMG;
              }
            }}
            className="size-full object-contain"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white p-5 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <SeverityBadge s={report.severity} />
            <span className="font-semibold text-slate-700">
              Keyakinan: {Math.round(report.confidence * 100)}%
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600">
              {report.kind === "pothole" ? "Lubang Jalan" : "Retakan Aspal"}
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">{report.date}</span>
          </div>
          <div>
            <StatusBadge s={report.status} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function EditModal({
  report,
  onClose,
  onSave,
  readOnly = false,
}: {
  report: Report;
  onClose: () => void;
  onSave?: (id: number, patch: Partial<Report>, from: Status, hide: boolean) => void;
  readOnly?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"annotated" | "original">(
    report.annotated_img ? "annotated" : "original",
  );
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [status, setStatus] = useState<Status>(
    report.status === "PENDING_REVIEW" ? "BARU" : report.status,
  );
  const [notes, setNotes] = useState(report.notes ?? "");
  const [hide, setHide] = useState(false);
  const [saving, setSaving] = useState(false);
  const locked = readOnly || report.status === "SELESAI";

  async function handleSave() {
    if (!onSave || readOnly) return;
    setSaving(true);
    try {
      // Sinkronisasi status ke backend FastAPI & Supabase
      await updateReportStatusApi(report.id, hide ? report.status : status, notes, hide);
    } catch (e) {
      console.warn("API sync failed, using local update:", e);
    } finally {
      onSave(report.id, hide ? { hidden: true, notes } : { status, notes }, report.status, hide);
      setSaving(false);
    }
  }

  const currentModalImg =
    activeTab === "annotated"
      ? report.annotated_img || report.img || DEFAULT_ROAD_IMG
      : report.img || DEFAULT_ROAD_IMG;

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
              {readOnly ? "Detail Laporan" : "Laporan"} #{report.id}
            </div>
            <h3 className="text-2xl font-extrabold">{report.street}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="grid size-9 place-items-center rounded-full bg-soft hover:bg-slate-200 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab switcher jika ada foto anotasi */}
        {report.annotated_img && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("annotated")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                activeTab === "annotated"
                  ? "bg-ink text-white shadow-sm"
                  : "bg-soft text-slate-600 hover:bg-slate-200"
              }`}
            >
              Deteksi AI (Box)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("original")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                activeTab === "original"
                  ? "bg-ink text-white shadow-sm"
                  : "bg-soft text-slate-600 hover:bg-slate-200"
              }`}
            >
              Foto Asli
            </button>
          </div>
        )}

        <div
          onClick={() => setShowFullPreview(true)}
          title="Klik untuk memperbesar citra resolusi penuh"
          className="group relative mt-2.5 cursor-pointer overflow-hidden rounded-2xl bg-soft"
        >
          <img
            src={currentModalImg}
            alt={report.street}
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              if (report.img && target.src !== report.img && target.src !== DEFAULT_ROAD_IMG) {
                target.src = report.img;
              } else if (target.src !== DEFAULT_ROAD_IMG) {
                target.onerror = null;
                target.src = DEFAULT_ROAD_IMG;
              }
            }}
            className="h-44 w-full object-cover transition duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
            <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1 text-xs font-semibold text-slate-900 shadow">
              <Maximize2 className="size-3.5" /> Perbesar Citra
            </span>
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium">
          Status penanganan
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            disabled={hide || locked}
            className="mt-1.5 w-full rounded-xl border border-line bg-soft px-3 py-2.5 text-sm disabled:opacity-75"
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
            className="mt-1.5 w-full resize-none rounded-xl border border-line bg-soft px-3 py-2.5 text-sm disabled:opacity-75"
          />
        </label>
        {!locked && !readOnly && (
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
            {locked || readOnly ? "Tutup" : "Batal"}
          </button>
          {!locked && !readOnly && onSave && (
            <button
              disabled={saving}
              onClick={handleSave}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Menyimpan…" : "Simpan progres"}
            </button>
          )}
        </div>
      </div>
      {showFullPreview && (
        <ImagePreviewModal report={report} onClose={() => setShowFullPreview(false)} />
      )}
    </div>
  );
}

export function RekapPage({ reports }: { reports: Report[] }) {
  const isos = reports.map((r) => r.iso).sort();
  const [from, setFrom] = useState(isos[0] ?? todayIso());
  const [to, setTo] = useState(todayIso() > (isos.at(-1) ?? "") ? todayIso() : isos.at(-1)!);
  const [st, setSt] = useState<"ALL" | Status>("ALL");

  const rows = useMemo(
    () =>
      reports.filter(
        (r) => !r.hidden && r.iso >= from && r.iso <= to && (st === "ALL" || r.status === st),
      ),
    [reports, from, to, st],
  );

  function downloadExcel() {
    const url = getExcelDownloadUrl(from, to, st);
    window.open(url, "_blank");
  }

  function downloadOfficialPdf() {
    const url = getPdfDownloadUrl(from, to, st);
    window.open(url, "_blank");
  }

  const field = "mt-1.5 rounded-xl border border-line bg-soft px-3 py-2.5 text-sm";

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
            onChange={(e) => setSt(e.target.value as "ALL" | Status)}
            className={`${field} block`}
          >
            <option value="ALL">Semua</option>
            {(["PENDING_REVIEW", ...STATUSES] as Status[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={downloadExcel}
            className="flex items-center gap-2 rounded-full border border-emerald-600 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            <Download className="size-4" /> Unduh Excel (.xlsx)
          </button>
          <button
            onClick={downloadOfficialPdf}
            className="flex items-center gap-2 rounded-full border border-ink bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-soft"
          >
            <FileText className="size-4" /> Unduh PDF
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
              Rekapitulasi
            </div>
            <h3 className="text-2xl font-extrabold">
              {from} s/d {to}
            </h3>
          </div>
          <div className="text-right">
            <div className="font-display text-5xl font-extrabold leading-none">{rows.length}</div>
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
  );
}
