import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-cyan-400 to-sky-500 text-slate-950 font-semibold shadow-[0_0_24px_-6px_rgba(34,211,238,0.8)] hover:brightness-110",
  secondary: "border border-cyan-400/40 bg-cyan-400/5 text-cyan-100 hover:bg-cyan-400/15",
  ghost: "text-slate-300 hover:bg-white/5 hover:text-white",
  danger: "border border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Card({ title, subtitle, actions, children, className = "" }: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-semibold tracking-wide text-white">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, hint, tone = "neon" }: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "neon" | "magenta" | "lime" | "warn";
}) {
  const color = {
    neon: "text-neon",
    magenta: "text-neon-2",
    lime: "text-lime",
    warn: "text-warn",
  }[tone];
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "info" | "success" | "warn"; children: ReactNode }) {
  const styles = {
    error: "border-rose-400/40 bg-rose-500/10 text-rose-100",
    info: "border-cyan-400/40 bg-cyan-400/10 text-cyan-100",
    success: "border-lime-400/40 bg-lime-400/10 text-lime-100",
    warn: "border-amber-400/40 bg-amber-400/10 text-amber-100",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function Spinner({ label = "Đang tải..." }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-sm text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
      {label}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-cyan-400/20 px-6 py-10 text-center">
      <p className="text-base font-semibold text-slate-200">{title}</p>
      <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-xs uppercase tracking-[0.3em] text-neon/80">{eyebrow}</p>}
        <h1 className="neon-text mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-slate-400">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Field({ label, error, children, hint }: {
  label: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-slate-500">{hint}</span>}
      {error && <span className="block text-xs text-rose-300">{error}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/20";

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("vi-VN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)} ms`;
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}
