import type { CallDirection, MetricTone } from "./types";

export function formatDurationLabel(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return "--:--";
  const sec = Math.floor(totalSec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatTalkTime(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return "--:--";
  const sec = Math.floor(totalSec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

export function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4) return raw || "—";
  const last = digits.slice(-4);
  if (digits.length > 10) return `+${digits.slice(0, digits.length - 10)} ******${last}`;
  return `+91 ******${last}`;
}

export function formatWhenLabel(iso: string | null, now = new Date()): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";

  const time = dt.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startThat = new Date(dt);
  startThat.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (startToday.getTime() - startThat.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (dayDiff === 0) return `Today · ${time}`;
  if (dayDiff === 1) return `Yesterday · ${time}`;
  if (dayDiff > 1 && dayDiff < 7) return `${dayDiff} days ago · ${time}`;
  return `${dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  })} · ${time}`;
}

export function directionBadgeClass(direction: CallDirection): string {
  switch (direction) {
    case "Incoming":
      return "bg-[#E6F7F5] text-[#0F766E]";
    case "Outgoing":
      return "bg-[#E8F0FE] text-[#1D4ED8]";
    case "Missed":
      return "bg-[#FDECEC] text-[#B91C1C]";
    case "Client rejected":
      return "bg-[#FFF6E8] text-[#B45309]";
    case "Sales rejected":
      return "bg-[#F3EBFF] text-[#7E22CE]";
    default:
      return "bg-[#F1F5F9] text-[#475569]";
  }
}

export const TONE_STYLES: Record<
  MetricTone,
  { iconBg: string; iconText: string; count: string }
> = {
  navy: {
    iconBg: "bg-[#E8EEF7]",
    iconText: "text-[#1E3A5F]",
    count: "text-[#1E3A5F]",
  },
  teal: {
    iconBg: "bg-[#E6F7F5]",
    iconText: "text-[#0D9488]",
    count: "text-[#0D9488]",
  },
  blue: {
    iconBg: "bg-[#E8F0FE]",
    iconText: "text-[#2563EB]",
    count: "text-[#2563EB]",
  },
  red: {
    iconBg: "bg-[#FDECEC]",
    iconText: "text-[#DC2626]",
    count: "text-[#DC2626]",
  },
  amber: {
    iconBg: "bg-[#FFF6E8]",
    iconText: "text-[#B45309]",
    count: "text-[#B45309]",
  },
  violet: {
    iconBg: "bg-[#F3EBFF]",
    iconText: "text-[#9333EA]",
    count: "text-[#9333EA]",
  },
};
