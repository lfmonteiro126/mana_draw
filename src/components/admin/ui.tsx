import Link from "next/link";
import type { ReactNode } from "react";

export const adminInputClass =
  "field-input h-11 w-full min-w-0 rounded-[var(--radius-control)] px-3 text-sm placeholder:text-[var(--muted)]";

export const adminInputWithIconClass =
  "field-input h-11 w-full rounded-[var(--radius-control)] pl-10 pr-3 text-sm placeholder:text-[var(--muted)]";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`surface-card min-w-0 p-4 sm:p-5 lg:p-6 ${className}`}>{children}</div>;
}

export function PanelHeader({
  action,
  badge,
  text,
  title,
  tone = "muted"
}: {
  action?: ReactNode;
  badge?: string;
  text: string;
  title: string;
  tone?: "muted" | "gold" | "accent";
}) {
  const badgeTone =
    tone === "gold"
      ? "bg-[var(--gold)]/12 text-[var(--gold)]"
      : tone === "accent"
        ? "bg-[var(--accent)]/12 text-[var(--accent-strong)]"
        : "bg-[var(--surface-hover)] text-[var(--muted)]";

  return (
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--ink)]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{text}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {badge ? (
          <span className={`w-fit rounded-[var(--radius-control)] px-3 py-2 text-xs font-semibold ${badgeTone}`}>
            {badge}
          </span>
        ) : null}
        {action}
      </div>
    </div>
  );
}

export function MetricCard({
  hint,
  icon,
  label,
  tone,
  value
}: {
  hint: string;
  icon: ReactNode;
  label: string;
  tone: "cyan" | "green" | "orange" | "red";
  value: string;
}) {
  const toneClass = {
    cyan: "text-teal-700 bg-teal-50",
    green: "text-emerald-700 bg-emerald-50",
    orange: "text-amber-700 bg-amber-50",
    red: "text-rose-700 bg-rose-50"
  }[tone];
  const bar = {
    cyan: "#0f9f90",
    green: "#059669",
    orange: "#d97706",
    red: "#e11d48"
  }[tone];

  return (
    <div className="admin-kpi min-w-0 p-4 sm:p-5" style={{ ["--kpi-accent" as string]: bar }}>
      <div className="mb-3 flex items-start justify-between gap-3 pl-1 sm:mb-4 sm:gap-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)] sm:h-10 sm:w-10 ${toneClass}`}>
          {icon}
        </span>
      </div>
      <strong className="block break-words pl-1 text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-[1.75rem]">
        {value}
      </strong>
      <p className="mt-2 pl-1 text-sm text-[var(--muted)]">{hint}</p>
    </div>
  );
}

export function EmptyState({
  action,
  icon,
  text,
  title
}: {
  action?: ReactNode;
  icon: ReactNode;
  text: string;
  title: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-6 py-10 text-center">
      <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]">
        {icon}
      </span>
      <p className="font-semibold text-[var(--ink)]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[var(--muted)]">{text}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] p-3 sm:p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] sm:text-[11px]">
        {label}
      </p>
      <p className="mt-1.5 break-words text-base font-semibold leading-tight text-[var(--ink)] sm:mt-2 sm:text-xl">
        {value}
      </p>
    </div>
  );
}

export function PriorityCard({
  href,
  label,
  text,
  value,
  urgent
}: {
  href: string;
  label: string;
  text: string;
  value: string;
  urgent?: boolean;
}) {
  return (
    <Link
      className={`group block rounded-[var(--radius-card)] border p-4 transition ${
        urgent
          ? "border-amber-200/90 bg-amber-50 hover:border-amber-300"
          : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface-soft)]"
      }`}
      href={href}
    >
      <div className="flex items-baseline justify-between gap-3">
        <strong className="text-3xl font-semibold tracking-tight text-[var(--ink)]">{value}</strong>
        {urgent ? (
          <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100/80">
            Urgente
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm font-semibold text-[var(--ink)] group-hover:text-[var(--accent-strong)]">{label}</p>
      <p className="mt-1 text-sm leading-5 text-[var(--muted)]">{text}</p>
    </Link>
  );
}

export function QueueRow({
  href,
  type,
  title,
  detail,
  urgency
}: {
  href: string;
  type: string;
  title: string;
  detail: string;
  urgency: "Alta" | "Média" | "Baixa";
}) {
  const urgencyClass =
    urgency === "Alta"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : urgency === "Média"
        ? "border-sky-200 bg-sky-50 text-sky-900"
        : "border-[var(--line)] bg-[var(--surface-soft)] text-[var(--muted)]";

  return (
    <Link
      href={href}
      className="grid gap-2 border-b border-[var(--line)] px-1 py-3.5 transition last:border-b-0 hover:bg-[var(--surface-soft)]/80 sm:grid-cols-[88px_minmax(0,1.2fr)_minmax(0,1fr)_72px] sm:items-center sm:gap-3"
    >
      <span className="w-fit rounded-[0.4rem] border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
        {type}
      </span>
      <p className="truncate text-sm font-semibold text-[var(--ink)]">{title}</p>
      <p className="truncate text-sm text-[var(--muted)]">{detail}</p>
      <span className={`w-fit justify-self-start rounded-full border px-2.5 py-0.5 text-[11px] font-semibold sm:justify-self-end ${urgencyClass}`}>
        {urgency}
      </span>
    </Link>
  );
}

export function SignalRow({ label, value, tone = "muted" }: { label: string; value: string | number; tone?: "muted" | "warn" | "danger" | "info" }) {
  const pill =
    tone === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : tone === "danger"
        ? "bg-rose-50 text-rose-800 border-rose-200"
        : tone === "info"
          ? "bg-sky-50 text-sky-900 border-sky-200"
          : "bg-[var(--surface-soft)] text-[var(--ink)] border-[var(--line)]";

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <span className={`inline-flex min-w-8 items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${pill}`}>
        {value}
      </span>
    </div>
  );
}

export function DataBar({
  accentClass,
  label,
  meta,
  percent,
  value
}: {
  accentClass: string;
  label: string;
  meta: string;
  percent: number;
  value: string;
}) {
  return (
    <div className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] p-3">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">{label}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{meta}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-[var(--ink)]">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div className={`h-full rounded-full ${accentClass}`} style={{ width: `${Math.max(percent, 3)}%` }} />
      </div>
    </div>
  );
}

export function FieldLabel({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

export function InfoValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-xs text-[var(--muted)] lg:hidden">{label}</span>
      <p className="truncate text-sm font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}

export function StatusBadge({
  label,
  className
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${
        className ?? "border-[var(--line)] bg-[var(--surface-soft)] text-[var(--ink)]"
      }`}
    >
      {label}
    </span>
  );
}

export function FilterChip({
  active,
  href,
  label,
  count
}: {
  active?: boolean;
  href: string;
  label: string;
  count?: number;
}) {
  return (
    <Link
      className={`chip inline-flex h-9 shrink-0 items-center gap-2 px-3 text-sm ${
        active ? "chip-active" : "text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
      }`}
      href={href}
    >
      {label}
      {typeof count === "number" ? (
        <span
          className={`rounded px-1.5 text-xs font-semibold ${
            active ? "bg-white/20 text-white" : "bg-[var(--accent)]/10 text-[var(--accent-strong)]"
          }`}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export function AlertBanner({
  tone,
  children
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent-strong)]";

  return (
    <div className={`mb-5 rounded-[var(--radius-control)] border px-4 py-3 text-sm font-medium ${styles}`}>
      {children}
    </div>
  );
}

export function NavItem({
  active,
  badge,
  href,
  icon,
  label
}: {
  active?: boolean;
  badge?: number;
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      className={`flex items-center gap-3 rounded-[0.55rem] px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "admin-nav-active"
          : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
      }`}
      href={href}
    >
      <span className={active ? "text-[var(--accent)]" : "text-[var(--muted)]"}>{icon}</span>
      <span className="min-w-0 flex-1">{label}</span>
      {badge ? (
        <span className="rounded-[0.4rem] bg-[var(--accent)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--accent-strong)]">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function NavSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      {children}
    </div>
  );
}
