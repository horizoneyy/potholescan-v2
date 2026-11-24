import { useState, useEffect } from "react";
import {
  Activity,
  ClipboardList,
  FileText,
  LayoutGrid,
  LogOut,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Card, Logo, SeverityBadge } from "./ui";
import { MapView } from "./MapView";
import { EditModal, RekapPage, ReportTable } from "./shared";
import { checkHealthApi } from "../api";
import {
  SEV_COLOR,
  type LogEntry,
  type Report,
  type Role,
  type Settings,
  type Severity,
  type Status,
  type User,
} from "../data";

type Page = "ringkasan" | "laporan" | "akun" | "pengaturan" | "audit" | "rekap";
const NAV: { id: Page; label: string; icon: typeof Users }[] = [
  { id: "ringkasan", label: "Ringkasan", icon: LayoutGrid },
  { id: "laporan", label: "Semua laporan", icon: ClipboardList },
  { id: "akun", label: "Akun staf", icon: Users },
  { id: "pengaturan", label: "Ambang AI", icon: SlidersHorizontal },
  { id: "audit", label: "Audit log", icon: Activity },
  { id: "rekap", label: "Rekap", icon: FileText },
];
const TITLE: Record<Page, string> = {
  ringkasan: "Pusat kendali",
  laporan: "Semua laporan",
  akun: "Kelola akun staf",
  pengaturan: "Ambang keyakinan",
  audit: "Rekaman audit",
  rekap: "Rekap",
};

interface Props {
  user: User;
  users: User[];
  reports: Report[];
  settings: Settings;
  logs: LogEntry[];
  update: (id: number, p: Partial<Report>, from: Status, hide: boolean) => void;
  addUser: (u: {
    username: string;
    password: string;
    fullName: string;
    role: Role;
  }) => string | null;
  toggleUser: (id: number) => void;
  deleteUser?: (id: number) => void;
  saveSettings: (s: Settings) => void;
  onLogout: () => void;
}

export function Admin({
  user,
  users,
  reports,
  settings,
  logs,
  update,
  addUser,
  toggleUser,
  deleteUser,
  saveSettings,
  onLogout,
}: Props) {
  const [page, setPage] = useState<Page>("ringkasan");
  const [edit, setEdit] = useState<Report | null>(null);
  const visible = reports.filter((r) => !r.hidden);
  const pending = visible.filter((r) => r.status === "PENDING_REVIEW").length;
  const berat = visible.filter(
    (r) => r.severity === "BERAT" && r.status !== "SELESAI",
  ).length;
  const selesai = visible.filter((r) => r.status === "SELESAI").length;
  const rate = visible.length
    ? Math.round((selesai / visible.length) * 100)
    : 0;

  return (
    <div className="flex min-h-screen bg-soft">
      <aside className="no-print sticky top-0 hidden h-screen w-72 flex-col border-r border-line bg-white p-5 lg:flex">
        <div className="px-2 pt-1">
          <Logo />
        </div>
        <div className="mt-6 rounded-2xl bg-soft p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Administrator
          </div>
          <div className="mt-1 font-display text-lg font-bold">
            {user.fullName}
          </div>
        </div>
        <nav className="mt-5 flex flex-1 flex-col gap-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${page === id ? "bg-ink text-white" : "text-slate-600 hover:bg-soft"}`}
            >
              <Icon className="size-5" />
              {label}
              {id === "laporan" && pending > 0 && (
                <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-ink">
                  {pending}
                </span>
              )}
            </button>
          ))}
        </nav>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:border-rose-400 hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="size-4" />
          Keluar
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="no-print flex items-center justify-between border-b border-line bg-white px-5 py-3 lg:hidden">
          <Logo />
          <button
            onClick={onLogout}
            className="rounded-lg border-2 border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-rose-400 hover:bg-rose-50 hover:text-rose-600"
          >
            Keluar
          </button>
        </div>
        <nav className="no-print flex gap-2 overflow-x-auto px-5 pt-4 lg:hidden">
          {NAV.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${page === id ? "bg-ink text-white" : "border border-line bg-white"}`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="p-5 sm:p-10">
          <header className="rise mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-amber-600">
                Panel administrator
              </div>
              <h1 className="mt-1 text-5xl font-extrabold sm:text-6xl">
                {TITLE[page]}
              </h1>
            </div>
          </header>

          {page === "ringkasan" && (
            <div className="space-y-5">
              <div className="relative overflow-hidden rounded-[2rem] bg-ink p-8 text-white sm:p-10">
                <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-amber-400/25 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-sky-400/15 blur-3xl" />
                <div className="relative grid gap-8 md:grid-cols-4">
                  <Big l="Total laporan" n={visible.length} />
                  <Big l="Berat aktif" n={berat} />
                  <Big l="Menunggu kurasi" n={pending} />
                  <Big l="Tingkat selesai" n={`${rate}%`} />
                </div>
              </div>
              <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
                <Card className="overflow-hidden">
                  <MapView reports={visible} className="h-[360px]" />
                </Card>
                <Card className="p-6">
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Aktivitas terbaru
                  </div>
                  <ul className="mt-4 space-y-4">
                    {logs.slice(0, 5).map((l) => (
                      <li key={l.id} className="flex gap-3 text-sm">
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-400" />
                        <div>
                          <div className="font-medium">{l.details}</div>
                          <div className="text-xs text-slate-500">
                            {l.actor} · {l.at}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
              <Card className="p-6">
                <div className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Distribusi keparahan
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {(["BERAT", "SEDANG", "RINGAN"] as Severity[]).map((s) => {
                    const n = visible.filter((r) => r.severity === s).length;
                    return (
                      <div key={s} className="rounded-2xl bg-soft p-5">
                        <SeverityBadge s={s} />
                        <div className="mt-3 font-display text-5xl font-extrabold">
                          {n}
                        </div>
                        <div className="mt-3 h-1.5 rounded-full bg-white">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(n / (visible.length || 1)) * 100}%`,
                              background: SEV_COLOR[s],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {page === "laporan" && (
            <Card className="overflow-hidden">
              <ReportTable
                rows={reports.filter((r) => !r.hidden)}
                readOnly={true}
              />
            </Card>
          )}
          {page === "akun" && (
            <Accounts
              users={users}
              addUser={addUser}
              toggleUser={toggleUser}
              deleteUser={deleteUser}
              me={user.id}
            />
          )}
          {page === "pengaturan" && (
            <div className="space-y-6">
              <Thresholds settings={settings} save={saveSettings} />
              <DatabaseSchemaCard />
            </div>
          )}
          {page === "audit" && (
            <Card className="overflow-hidden">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Waktu</th>
                    <th>Aktor</th>
                    <th>Aksi</th>
                    <th>Target</th>
                    <th className="pr-5">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-t border-line">
                      <td className="px-5 py-3 text-slate-500">{l.at}</td>
                      <td className="font-medium">{l.actor}</td>
                      <td>
                        <span className="rounded-md bg-soft px-2 py-1 font-mono text-[11px]">
                          {l.action}
                        </span>
                      </td>
                      <td className="text-slate-500">{l.target}</td>
                      <td className="pr-5">{l.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {page === "rekap" && <RekapPage reports={reports} />}
        </div>
      </div>
      {edit && (
        <EditModal
          report={edit}
          onClose={() => setEdit(null)}
          onSave={(id, p, from, hide) => {
            update(id, p, from, hide);
            setEdit(null);
          }}
        />
      )}
    </div>
  );
}

function Big({ n, l }: { n: number | string; l: string }) {
  return (
    <div>
      <div className="font-display text-6xl font-extrabold leading-none sm:text-7xl">
        {n}
      </div>
      <div className="mt-3 text-xs font-medium uppercase tracking-widest text-slate-400">
        {l}
      </div>
    </div>
  );
}

function Accounts({
  users,
  addUser,
  toggleUser,
  deleteUser,
  me,
}: {
  users: User[];
  addUser: Props["addUser"];
  toggleUser: (id: number) => void;
  deleteUser?: (id: number) => void;
  me: number;
}) {
  const [f, setF] = useState({
    fullName: "",
    username: "",
    password: "",
    role: "petugas" as Role,
  });
  const [err, setErr] = useState("");
  const inp =
    "mt-1.5 w-full rounded-xl border border-line bg-soft px-3 py-2.5 text-sm";
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Card className="overflow-hidden">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-widest text-slate-400">
            <tr>
              <th className="px-5 py-3">Pengguna</th>
              <th>Peran</th>
              <th>Status</th>
              <th className="pr-5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-full bg-soft font-display font-bold">
                      {u.fullName[0]}
                    </div>
                    <div>
                      <div className="font-semibold">{u.fullName}</div>
                      <div className="text-xs text-slate-500">
                        @{u.username}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${u.role === "admin" ? "bg-ink text-white" : "bg-soft"}`}
                  >
                    {u.role}
                  </span>
                </td>
                <td
                  className={u.active ? "text-emerald-600" : "text-slate-400"}
                >
                  {u.active ? "Aktif" : "Nonaktif"}
                </td>
                <td className="pr-5 text-right">
                  {u.id !== me && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleUser(u.id)}
                        className="rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold hover:bg-soft"
                      >
                        {u.active ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      {deleteUser && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Hapus staf ${u.fullName}?`)) {
                              deleteUser(u.id);
                            }
                          }}
                          title="Hapus akun staf"
                          className="grid size-8 place-items-center rounded-full border border-red-200 text-red-500 transition hover:bg-red-50"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="h-fit p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          <UserPlus className="size-4" />
          Akun baru
        </div>
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const m = addUser(f);
            setErr(m ?? "");
            if (!m)
              setF({
                fullName: "",
                username: "",
                password: "",
                role: "petugas",
              });
          }}
        >
          <label className="block text-sm font-medium">
            Nama lengkap
            <input
              value={f.fullName}
              onChange={(e) => setF({ ...f, fullName: e.target.value })}
              className={inp}
            />
          </label>
          <label className="mt-3 block text-sm font-medium">
            Username
            <input
              value={f.username}
              onChange={(e) => setF({ ...f, username: e.target.value })}
              className={inp}
            />
          </label>
          <label className="mt-3 block text-sm font-medium">
            Kata sandi
            <input
              type="password"
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
              className={inp}
            />
          </label>
          <label className="mt-3 block text-sm font-medium">
            Peran
            <select
              value={f.role}
              onChange={(e) => setF({ ...f, role: e.target.value as Role })}
              className={inp}
            >
              <option value="petugas">Petugas</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
          <button className="mt-5 w-full rounded-2xl bg-ink py-3 text-sm font-semibold text-white hover:bg-slate-800">
            Buat akun
          </button>
        </form>
      </Card>
    </div>
  );
}

function Thresholds({
  settings,
  save,
}: {
  settings: Settings;
  save: (s: Settings) => void;
}) {
  const [s, setS] = useState(settings);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setS(settings);
  }, [settings]);

  const bad = s.min >= s.publish;
  const Row = ({
    label,
    desc,
    k,
    min,
    max,
    step,
    fmt,
  }: {
    label: string;
    desc: string;
    k: keyof Settings;
    min: number;
    max: number;
    step: number;
    fmt: (v: number) => string;
  }) => (
    <div className="border-b border-line py-6 first:pt-0 last:border-0 last:pb-0">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="font-display text-xl font-bold">{label}</div>
          <div className="text-sm text-slate-500">{desc}</div>
        </div>
        <div className="font-display text-5xl font-extrabold leading-none">
          {fmt(s[k])}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={s[k]}
        onChange={(e) => {
          setOk(false);
          setS({ ...s, [k]: +e.target.value });
        }}
        className="mt-5 w-full accent-slate-900"
      />
    </div>
  );
  return (
    <Card className="max-w-3xl p-8">
      <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-xs text-sky-800">
        Ambang batas di bawah ini terhubung langsung ke inferensi AI YOLOv8 (
        <code>conf_min</code>). Nilai kalibrasi bawaan berasal dari metrik hasil
        latih bobot model <code>best.pt</code> (F1-Score optimal 0.25).
      </div>
      <Row
        label="Ambang minimal deteksi"
        desc="Deteksi di bawah angka ini diabaikan sebagai jalan normal."
        k="min"
        min={0.1}
        max={0.6}
        step={0.01}
        fmt={(v) => v.toFixed(2)}
      />
      <Row
        label="Ambang publikasi otomatis"
        desc="Di atas angka ini laporan langsung tampil di peta publik."
        k="publish"
        min={0.3}
        max={0.95}
        step={0.01}
        fmt={(v) => v.toFixed(2)}
      />
      <Row
        label="Radius peringatan"
        desc="Jarak pencarian lubang aktif di sekitar pengendara."
        k="radius"
        min={100}
        max={2000}
        step={50}
        fmt={(v) => `${v} m`}
      />
      {bad && (
        <p className="mt-4 text-sm text-red-600">
          Ambang minimal harus lebih kecil dari ambang publikasi.
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          disabled={bad}
          onClick={() => {
            save(s);
            setOk(true);
          }}
          className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Simpan pengaturan
        </button>
        <button
          type="button"
          onClick={() => {
            const calibrated = { min: 0.25, publish: 0.65, radius: 500 };
            setS(calibrated);
            save(calibrated);
            setOk(true);
          }}
          className="rounded-full border border-line bg-white px-5 py-3 text-sm font-semibold hover:bg-soft"
        >
          Reset ke Standar Model Latihan (best.pt)
        </button>
        {ok && (
          <span className="text-sm font-medium text-emerald-600">
            Tersimpan ke sistem dan audit log.
          </span>
        )}
      </div>
    </Card>
  );
}

function DatabaseSchemaCard() {
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);

  useEffect(() => {
    checkHealthApi()
      .then((res) => setSupabaseConnected(res.supabase_connected))
      .catch(() => setSupabaseConnected(false));
  }, []);

  return (
    <Card className="max-w-3xl p-8">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">
            Skema Basis Data Spasial Supabase PostgreSQL
          </h3>
          <p className="text-xs text-slate-500">
            Struktur relasional sistem GIS & inferensi AI PotholeScan
          </p>
        </div>
        <div className="flex items-center gap-2">
          {supabaseConnected === null ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-[11px] font-semibold text-slate-600">
              Memeriksa Supabase...
            </span>
          ) : supabaseConnected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-mono text-[11px] font-semibold text-emerald-700">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Supabase Terhubung (PostGIS 3.4)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-mono text-[11px] font-semibold text-amber-700">
              <span className="size-2 rounded-full bg-amber-500" />
              Supabase Mode Fallback
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            A. 6 Tabel Operasional Aplikasi
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
            <div className="rounded-xl border border-line bg-soft/50 p-3">
              <span className="font-mono font-bold text-slate-800">
                public.users
              </span>
              <p className="mt-1 text-slate-500">
                Akun autentikasi RBAC (Admin & Petugas) terenkripsi Argon2id.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-soft/50 p-3">
              <span className="font-mono font-bold text-slate-800">
                public.reports
              </span>
              <p className="mt-1 text-slate-500">
                Entitas master agregasi laporan, koordinat GPS, status &
                keparahan.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-soft/50 p-3">
              <span className="font-mono font-bold text-slate-800">
                public.detections
              </span>
              <p className="mt-1 text-slate-500">
                Rincian kotak deteksi bounding box YOLOv8, rasio area, dan
                confidence.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-soft/50 p-3">
              <span className="font-mono font-bold text-slate-800">
                public.status_history
              </span>
              <p className="mt-1 text-slate-500">
                Jejak audit siklus hidup status (BARU &rarr; VERIFIKASI &rarr;
                DIKERJAKAN &rarr; SELESAI).
              </p>
            </div>
            <div className="rounded-xl border border-line bg-soft/50 p-3">
              <span className="font-mono font-bold text-slate-800">
                public.system_settings
              </span>
              <p className="mt-1 text-slate-500">
                Persistensi parameter dinamis AI (ambang minimal, publikasi, &
                radius).
              </p>
            </div>
            <div className="rounded-xl border border-line bg-soft/50 p-3">
              <span className="font-mono font-bold text-slate-800">
                public.audit_logs
              </span>
              <p className="mt-1 text-slate-500">
                Rekam jejak kepatuhan dan histori aksi mutasi pengguna sistem.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
          <div className="font-bold">
            B. 1 Tabel Sistem PostGIS Internal (spatial_ref_sys)
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
            Tabel{" "}
            <code className="rounded bg-amber-100 px-1 font-mono">
              public.spatial_ref_sys
            </code>{" "}
            adalah tabel metadata standar proyeksi koordinat EPSG bawaan
            ekstensi PostGIS (SRID 4326/WGS84) yang digunakan engine database
            untuk kalkulasi jarak spasial, bukan tabel data operasional
            transaksi PotholeScan.
          </p>
        </div>
      </div>
    </Card>
  );
}
