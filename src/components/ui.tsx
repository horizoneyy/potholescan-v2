import type { ReactNode } from "react";
import { SEV_COLOR, STATUS_LABEL, type Severity, type Status } from "../data";

export function SeverityBadge({ s }: { s: Severity }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-soft px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-700">
      <span className="size-1.5 rounded-full" style={{ background: SEV_COLOR[s] }} />
      {s}
    </span>
  );
}

const statusStyle: Record<Status, string> = {
  PENDING_REVIEW: "bg-amber-50 text-amber-700 ring-amber-200",
  BARU: "bg-sky-50 text-sky-700 ring-sky-200",
  DIVERIFIKASI: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  DALAM_PENANGANAN: "bg-orange-50 text-orange-700 ring-orange-200",
  SELESAI: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function StatusBadge({ s }: { s: Status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${statusStyle[s]}`}
    >
      {STATUS_LABEL[s]}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.08)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-xl bg-ink">
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2.5" fill="#f5a524" stroke="none" />
        </svg>
      </div>
      <span className={`font-display text-lg font-extrabold ${dark ? "text-white" : "text-ink"}`}>
        PotholeScan
      </span>
    </div>
  );
}
