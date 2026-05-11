const NEW_CRM_LEADS_CUTOFF_DATE =
  process.env.NEXT_PUBLIC_NEW_CRM_LEADS_CUTOFF_DATE?.trim() || "";

function parseUtcDayStartMs(value: string): number | null {
  const parsed = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function getNewCrmLeadsCutoffDate(): string | null {
  return NEW_CRM_LEADS_CUTOFF_DATE || null;
}

export function getEffectiveNewCrmStartDate(dateFrom?: string | null): string | null {
  const cutoff = NEW_CRM_LEADS_CUTOFF_DATE;
  const requested = (dateFrom || "").trim();

  if (!cutoff) return requested || null;
  if (!requested) return cutoff;

  const cutoffMs = parseUtcDayStartMs(cutoff);
  const requestedMs = parseUtcDayStartMs(requested);

  if (cutoffMs == null) return requested || null;
  if (requestedMs == null) return cutoff;

  return requestedMs < cutoffMs ? cutoff : requested;
}

export function getEffectiveNewCrmEndDate(
  dateFrom?: string | null,
  dateTo?: string | null,
): string | null {
  const requested = (dateTo || "").trim();
  if (!requested) return null;

  const effectiveFrom = getEffectiveNewCrmStartDate(dateFrom);
  if (!effectiveFrom) return requested;

  const fromMs = parseUtcDayStartMs(effectiveFrom);
  const requestedMs = parseUtcDayStartMs(requested);

  if (fromMs == null || requestedMs == null) return requested;
  return requestedMs < fromMs ? effectiveFrom : requested;
}

export function setEffectiveNewCrmStartDate(
  query: URLSearchParams,
  dateFrom?: string | null,
): string | null {
  const effective = getEffectiveNewCrmStartDate(dateFrom);
  if (effective) query.set("dateFrom", effective);
  else query.delete("dateFrom");
  return effective;
}

export function setEffectiveNewCrmDateRange(
  query: URLSearchParams,
  dateFrom?: string | null,
  dateTo?: string | null,
): { from: string | null; to: string | null } {
  const from = setEffectiveNewCrmStartDate(query, dateFrom);
  const to = getEffectiveNewCrmEndDate(dateFrom, dateTo);
  if (to) query.set("dateTo", to);
  else query.delete("dateTo");
  return { from, to };
}

export function getLeadCreatedAtMs(lead: unknown): number | null {
  if (!lead || typeof lead !== "object") return null;

  const record = lead as Record<string, unknown>;
  const raw =
    record.raw && typeof record.raw === "object" && !Array.isArray(record.raw)
      ? (record.raw as Record<string, unknown>)
      : null;
  const value =
    raw?.createdAt ??
    raw?.created_at ??
    record.createdAt ??
    record.created_at ??
    record.createdDate ??
    record.leadDate ??
    record.createdOn ??
    null;

  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const parsed = new Date(String(value)).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function applyNewCrmCutoff<T extends object>(leads: T[], isNewCrm = true): T[] {
  if (!isNewCrm) return leads;
  if (!NEW_CRM_LEADS_CUTOFF_DATE) return leads;

  const cutoffMs = parseUtcDayStartMs(NEW_CRM_LEADS_CUTOFF_DATE);
  if (cutoffMs == null) return leads;

  return leads.filter((lead) => {
    const createdAtMs = getLeadCreatedAtMs(lead);
    if (createdAtMs == null) return true;
    return createdAtMs >= cutoffMs;
  });
}
