import { useMemo, useState } from 'react'
import { ClipboardList, FileText, LayoutGrid, LogOut, Map } from 'lucide-react'
import { Card, Logo } from './ui'
import { MapView } from './MapView'
import { EditModal, RekapPage, ReportTable } from './shared'
import { SEV_COLOR, type Report, type Severity, type Status, type User } from '../data'

type Page = 'ringkasan' | 'peta' | 'laporan' | 'rekap'
type Tab = 'pending' | 'aktif' | 'semua'
const NAV: { id: Page; label: string; icon: typeof Map }[] = [
  { id: 'ringkasan', label: 'Ringkasan', icon: LayoutGrid },
  { id: 'peta', label: 'Peta lapangan', icon: Map },
  { id: 'laporan', label: 'Laporan', icon: ClipboardList },
  { id: 'rekap', label: 'Rekap PDF', icon: FileText },
]
const TITLE: Record<Page, string> = { ringkasan: 'Dashboard operasional', peta: 'Peta lapangan', laporan: 'Laporan masuk', rekap: 'Rekap resmi' }

export function Staff({ user, reports, update, onLogout }: { user: User; reports: Report[]; update: (id: number, p: Partial<Report>, from: Status, hide: boolean) => void; onLogout: () => void }) {
  const [page, setPage] = useState<Page>('ringkasan')
  const [tab, setTab] = useState<Tab>('pending')
  const [edit, setEdit] = useState<Report | null>(null)

  const visible = reports.filter((r) => !r.hidden)
  const pending = visible.filter((r) => r.status === 'PENDING_REVIEW')
  const aktif = visible.filter((r) => ['BARU', 'DIVERIFIKASI', 'DALAM_PENANGANAN'].includes(r.status))
  const done = visible.filter((r) => r.status === 'SELESAI')
  const rows = tab === 'pending' ? pending : tab === 'aktif' ? aktif : visible
  const sev = useMemo(() => (['BERAT', 'SEDANG', 'RINGAN'] as Severity[]).map((s) => ({ s, n: visible.filter((r) => r.severity === s).length })), [visible])
  const week = [3, 5, 4, 8, 6, 9, 7]

  const table = (
    <Card className="overflow-hidden">
      <div className="flex items-center border-b border-line p-4">
        <div className="flex rounded-full bg-soft p-1 text-sm font-medium">
          {([['pending', `Antrean (${pending.length})`], ['aktif', `Aktif (${aktif.length})`], ['semua', 'Semua']] as [Tab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 transition ${tab === k ? 'bg-white shadow-sm' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
      </div>
      <ReportTable rows={rows} onOpen={setEdit} />
    </Card>
  )

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-24 flex-col items-center justify-between bg-ink py-6 md:flex">
        <div className="grid size-11 place-items-center rounded-2xl bg-white/10"><svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" fill="#f5a524" stroke="none" /></svg></div>
        <nav className="flex flex-col gap-3">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} title={label} aria-label={label} onClick={() => setPage(id)} className={`grid size-12 place-items-center rounded-2xl transition ${page === id ? 'bg-white text-ink' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}><Icon className="size-6" /></button>
          ))}
        </nav>
        <button onClick={onLogout} aria-label="Keluar" title="Keluar" className="grid size-12 place-items-center rounded-2xl text-slate-400 hover:bg-white/10 hover:text-white"><LogOut className="size-6" /></button>
      </aside>

      <div className="min-w-0 flex-1 p-5 sm:p-8">
        <div className="no-print mb-4 flex items-center justify-between md:hidden"><Logo /><button onClick={onLogout} className="text-sm text-slate-500">Keluar</button></div>
        <nav className="no-print mb-4 flex gap-2 overflow-x-auto md:hidden">
          {NAV.map(({ id, label }) => <button key={id} onClick={() => setPage(id)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${page === id ? 'bg-ink text-white' : 'bg-white border border-line'}`}>{label}</button>)}
        </nav>
        <header className="rise">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Petugas lapangan · {user.fullName}</div>
          <h1 className="mt-1 text-5xl font-extrabold sm:text-6xl">{TITLE[page]}</h1>
        </header>

        {page === 'ringkasan' && (
          <>
            <section className="mt-8 grid gap-4 lg:grid-cols-12">
              <Card className="relative overflow-hidden !border-ink !bg-ink p-7 text-white lg:col-span-5">
                <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-amber-400/20 blur-3xl" />
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Antrean kurasi</div>
                <div className="mt-3 font-display text-8xl font-extrabold leading-none">{pending.length}</div>
                <p className="mt-3 max-w-xs text-sm text-slate-300">Laporan dengan keyakinan rendah menunggu keputusan Anda.</p>
                <button onClick={() => { setTab('pending'); setPage('laporan') }} className="mt-6 rounded-full bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/20">Tinjau antrean</button>
              </Card>
              <div className="grid grid-cols-2 gap-4 lg:col-span-4">
                <Card className="p-5"><div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Aktif</div><div className="mt-2 font-display text-6xl font-extrabold">{aktif.length}</div></Card>
                <Card className="p-5"><div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Selesai</div><div className="mt-2 font-display text-6xl font-extrabold">{done.length}</div></Card>
                <Card className="col-span-2 p-5">
                  <div className="mb-3 flex justify-between text-xs font-semibold uppercase tracking-widest text-slate-500"><span>Keparahan</span><span>{visible.length} laporan</span></div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-soft">{sev.map((x) => <div key={x.s} style={{ width: `${(x.n / (visible.length || 1)) * 100}%`, background: SEV_COLOR[x.s] }} />)}</div>
                  <div className="mt-3 flex gap-5 text-sm">{sev.map((x) => <span key={x.s} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: SEV_COLOR[x.s] }} /><b>{x.n}</b> <span className="text-slate-500">{x.s.toLowerCase()}</span></span>)}</div>
                </Card>
              </div>
              <Card className="p-5 lg:col-span-3">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Laporan masuk · 7 hari</div>
                <div className="mt-4 flex h-32 items-end gap-2">
                  {week.map((v, i) => <div key={i} className="flex flex-1 flex-col items-center gap-1.5"><div className="w-full rounded-lg" style={{ height: `${v * 10}%`, background: i === 5 ? '#0f172a' : '#e2e8f0' }} /><span className="text-[10px] text-slate-400">{'SSRKJSM'[i]}</span></div>)}
                </div>
              </Card>
            </section>
            <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
              {table}
              <Card className="overflow-hidden"><MapView reports={visible} className="h-64 xl:h-full xl:min-h-[320px]" /></Card>
            </section>
          </>
        )}

        {page === 'peta' && <Card className="mt-8 overflow-hidden"><MapView reports={visible} className="h-[70vh] min-h-[420px]" /></Card>}
        {page === 'laporan' && <div className="mt-8">{table}</div>}
        {page === 'rekap' && <div className="mt-8"><RekapPage reports={reports} /></div>}
      </div>
      {edit && <EditModal report={edit} onClose={() => setEdit(null)} onSave={(id, p, from, hide) => { update(id, p, from, hide); setEdit(null) }} />}
    </div>
  )
}
