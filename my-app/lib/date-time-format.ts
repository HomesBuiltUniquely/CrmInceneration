export function parseCrmDateTime(input: unknown): Date | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const raw = input.trim();
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const utcCandidate = new Date(`${raw}Z`);
  return Number.isNaN(utcCandidate.getTime()) ? null : utcCandidate;
}

export function formatCrmDateTime(input: unknown): string {
  const dt = input instanceof Date ? input : parseCrmDateTime(input);
  if (!dt) return "—";
  const day = String(dt.getDate()).padStart(2, "0");
  const month = dt.toLocaleString("en-US", { month: "long" });
  const year = dt.getFullYear();
  const h = dt.getHours();
  const hour12 = h % 12 || 12;
  const minutes = String(dt.getMinutes()).padStart(2, "0");
  const seconds = String(dt.getSeconds()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${day} ${month} ${year}, ${hour12}:${minutes}:${seconds} ${ampm}`;
}
