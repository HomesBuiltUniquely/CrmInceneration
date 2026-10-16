import { cn } from "@/lib/cn";
import { meetingTypeKind, type MeetingTypeKind } from "@/lib/meeting-slot";
import { SLOT_TYPE } from "../slot-constants";

export function TypeIcon({ kind, className }: { kind: MeetingTypeKind; className?: string }) {
  const common = cn("h-3.5 w-3.5", className);
  if (kind === "showroom") {
    return (
      <svg viewBox="0 0 16 16" className={common} fill="none" aria-hidden>
        <path d="M2.5 7.2 8 3.2l5.5 4M4 6.8V13h8V6.8" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6.5 13V9.2h3V13" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (kind === "virtual") {
    return (
      <svg viewBox="0 0 16 16" className={common} fill="none" aria-hidden>
        <rect x="2" y="4" width="8.5" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10.5 7.2 14 5.2v5.6l-3.5-2" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className={common} fill="none" aria-hidden>
      <path d="M4 8h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function TypeDot({ type, className }: { type?: string; className?: string }) {
  const kind = meetingTypeKind(type);
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full transition-transform duration-150 group-hover:h-2.5 group-hover:w-2.5", className)} style={{ background: SLOT_TYPE[kind].dot }} />;
}

export function TypeTag({ type }: { type?: string }) {
  const kind = meetingTypeKind(type);
  const token = SLOT_TYPE[kind];
  const label = kind === "showroom" ? "Showroom visit" : kind === "virtual" ? "Virtual meeting" : "";
  if (!label) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold"
      style={{ background: token.bg, borderColor: token.border, color: token.text }}
    >
      <TypeIcon kind={kind} />
      {label}
    </span>
  );
}
