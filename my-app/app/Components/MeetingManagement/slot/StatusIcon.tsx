import { cn } from "@/lib/cn";
import { knownSlotStatus } from "@/lib/meeting-slot";

export function StatusIcon({ status, className }: { status?: string; className?: string }) {
  const known = knownSlotStatus(status);
  if (!known) return null;
  const label = known === "COMPLETED" ? "Completed" : known === "IN PROGRESS" ? "In progress" : "Scheduled";
  return (
    <span role="img" aria-label={label} className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center", className)}>
      {known === "COMPLETED" ? (
        <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#15803D]" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5 8.2 7.1 10.2 11 6.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {known === "IN PROGRESS" ? <span className="slot-status-pulse h-2 w-2 rounded-full bg-[#D97706]" /> : null}
      {known === "SCHEDULED" ? (
        <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#1D4ED8]" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 5v3.2L10.2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ) : null}
    </span>
  );
}
