"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

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
    "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300",
  success:
    "bg-gradient-to-br from-[var(--crm-success-start,#34d399)] to-[var(--crm-success-end,#10b981)] text-[var(--crm-success-text,#06281d)] font-semibold shadow-[0_12px_24px_rgba(16,185,129,0.24)] hover:-translate-y-px",
  danger: "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100",
  outline:
    "border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100",
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
        "rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_36px_rgba(15,23,42,0.06)] transition-all duration-200 hover:border-slate-300",
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
  blue: "bg-blue-100 text-blue-600",
  green: "bg-emerald-100 text-emerald-600",
  orange: "bg-amber-100 text-amber-600",
  purple: "bg-violet-100 text-violet-600",
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
      <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-slate-500">
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
    <label className="mb-[6px] block text-[11px] font-medium tracking-[0.3px] text-slate-500">
      {children}
      {required && <span className="ml-1 text-amber-300">*</span>}
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
        "w-full rounded-xl border bg-slate-50 text-[13.5px] font-medium text-slate-900",
        "px-3.5 py-2.5 outline-none transition-all duration-200 placeholder:font-normal placeholder:text-slate-400",
        "focus:border-blue-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(96,165,250,0.12)]",
        missing ? "border-red-500 bg-red-100" : "border-slate-200",
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
        "min-h-[90px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13.5px] font-medium leading-relaxed text-slate-900 outline-none",
        "placeholder:font-normal placeholder:text-slate-400 transition-all duration-200 focus:border-blue-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(96,165,250,0.12)]",
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
        "w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 pr-9 text-[13.5px] font-medium text-slate-900 outline-none transition-all duration-200 focus:border-blue-400 focus:bg-white",
        "bg-[image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")] bg-no-repeat bg-[right_12px_center]",
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
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
      {status}
    </span>
  );
}

/* ─────────────────────────────────────────────
   MONO TAG
───────────────────────────────────────────── */
export function MonoTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-500">
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────
   REQUIREMENT CHIP
───────────────────────────────────────────── */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="mr-1.5 mb-1.5 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11.5px] font-medium text-slate-600">
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
      <span className="flex items-center gap-2 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.8px] text-slate-500">
        {icon} {title}
      </span>
      <div className="h-px flex-1 bg-slate-200" />
      {action && <div>{action}</div>}
    </div>
  );
}
