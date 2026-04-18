"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { dedupeLeadSources, formatLeadSourceLabel } from "@/lib/lead-source-utils";

/* ─────────────────────────────────────────────
   BUTTON
───────────────────────────────────────────── */
type ButtonVariant = "primary" | "ghost" | "success" | "danger" | "outline";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-br from-[var(--primary-start,#60a5fa)] to-[var(--primary-end,#2563eb)] text-white shadow-[0_12px_24px_rgba(37,99,235,0.28)] hover:-translate-y-px",
  ghost:
    "border border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-subtle)] hover:text-[var(--crm-text-primary)] hover:border-[var(--crm-border-strong)]",
  success:
    "bg-gradient-to-br from-[var(--crm-success)] to-[var(--crm-success-text)] text-white font-semibold shadow-[var(--crm-shadow-sm)] hover:-translate-y-px",
  danger: "border border-[var(--crm-danger)] bg-[var(--crm-danger-bg)] text-[var(--crm-danger-text)] hover:brightness-110",
  outline:
    "border border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)] text-[var(--crm-accent)] hover:brightness-110",
};

export function Button({
  variant = "ghost",
  icon,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 font-semibold text-[13px] px-4 py-2 rounded-lg transition-all duration-200 cursor-pointer select-none",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {icon && <span className="text-base leading-none">{icon}</span>}
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────
   CARD
───────────────────────────────────────────── */
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-[var(--crm-shadow-sm)] transition-all duration-200 hover:border-[var(--crm-border-strong)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   CARD TITLE
───────────────────────────────────────────── */
type IconColor = "blue" | "green" | "orange" | "purple";

const iconColorMap: Record<IconColor, string> = {
  blue: "bg-[var(--crm-accent-soft)] text-[var(--crm-accent)]",
  green: "bg-[var(--crm-success-bg)] text-[var(--crm-success-text)]",
  orange: "bg-[var(--crm-warning-bg)] text-[var(--crm-warning-text)]",
  purple: "bg-[var(--crm-info-bg)] text-[var(--crm-info-text)]",
};

export function CardTitle({
  icon,
  color = "orange",
  children,
  action,
}: {
  icon: string;
  color?: IconColor;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <span
        className={cn(
          "w-[22px] h-[22px] rounded-md flex items-center justify-center text-xs",
          iconColorMap[color],
        )}
      >
        {icon}
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--crm-text-muted)]">
        {children}
      </span>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   FIELD LABEL + INPUT
───────────────────────────────────────────── */
export function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-[6px] block text-[11px] font-medium tracking-[0.3px] text-[var(--crm-text-muted)]">
      {children}
      {required && <span className="ml-1 text-[var(--crm-required)]">*</span>}
    </label>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  missing?: boolean;
}

export function Input({ missing, className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-[var(--crm-border)] bg-[var(--crm-input-bg)] text-[13.5px] font-medium text-[var(--crm-text-primary)]",
        "px-3.5 py-2.5 outline-none transition-all duration-200 placeholder:font-normal placeholder:text-[var(--crm-text-muted)]",
        "focus:border-[var(--crm-accent)] focus:shadow-[0_0_0_3px_var(--crm-accent-ring)]",
        missing ? "border-[var(--crm-danger)] bg-[var(--crm-danger-bg)]" : "",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[90px] w-full resize-y rounded-xl border border-[var(--crm-border)] bg-[var(--crm-input-bg)] px-3.5 py-2.5 text-[13.5px] font-medium leading-relaxed text-[var(--crm-text-primary)] outline-none",
        "placeholder:font-normal placeholder:text-[var(--crm-text-muted)] transition-all duration-200 focus:border-[var(--crm-accent)] focus:shadow-[0_0_0_3px_var(--crm-accent-ring)]",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full cursor-pointer appearance-none rounded-xl border border-[var(--crm-border)] bg-[var(--crm-input-bg)] px-3.5 py-2.5 pr-9 text-[13.5px] font-medium text-[var(--crm-text-primary)] outline-none transition-all duration-200 focus:border-[var(--crm-accent)]",
        "bg-[image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")] bg-no-repeat bg-[right_12px_center]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/* ─────────────────────────────────────────────
   STATUS PILL
───────────────────────────────────────────── */
export function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--crm-success)] bg-[var(--crm-success-bg)] px-3 py-1 text-[12px] font-semibold text-[var(--crm-success-text)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--crm-success)] animate-pulse-dot" />
      {status}
    </span>
  );
}

/** Primary tag = `leadSource` from GET details; optional chips = parsed `additionalLeadSources`. */
export function LeadSourceTag({ primary, extras }: { primary: string; extras?: string[] }) {
  const deduped = dedupeLeadSources([primary, ...(extras ?? [])]);
  const main = deduped[0] ?? "External Lead";
  return (
    <span className="inline-flex items-center">
      <span className="inline-flex rounded-full border border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--crm-accent)]">
        {formatLeadSourceLabel(main)}
      </span>
    </span>
  );
}

/* ─────────────────────────────────────────────
   MONO TAG
───────────────────────────────────────────── */
export function MonoTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-2 py-1 font-mono text-[11px] text-[var(--crm-text-muted)]">
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────
   REQUIREMENT CHIP
───────────────────────────────────────────── */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="mr-1.5 mb-1.5 inline-flex items-center rounded-full border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-1 text-[11.5px] font-medium text-[var(--crm-text-secondary)]">
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────
   SECTION HEADER WITH DIVIDER
───────────────────────────────────────────── */
export function SectionHeader({
  icon,
  title,
  action,
}: {
  icon: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="flex items-center gap-2 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.8px] text-[var(--crm-text-muted)]">
        {icon} {title}
      </span>
      <div className="h-px flex-1 bg-[var(--crm-border)]" />
      {action && <div>{action}</div>}
    </div>
  );
}
