function parseUtcDayStartMs(value: string): number | null {
  const parsed = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/** @deprecated No global lead visibility cutoff — always returns null. */
export function getNewCrmLeadsCutoffDate(): string | null {
  return null;
}

export function getEffectiveNewCrmStartDateForRole(
  _role: string,
  dateFrom?: string | null,
): string | null {
  return getEffectiveNewCrmStartDate(dateFrom);
}

export function getEffectiveNewCrmStartDate(dateFrom?: string | null): string | null {
  const requested = (dateFrom || "").trim();
  return requested || null;
}

export function getEffectiveNewCrmEndDateForRole(
  _role: string,
  dateFrom?: string | null,
  dateTo?: string | null,
): string | null {
  return getEffectiveNewCrmEndDate(dateFrom, dateTo);
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

/** @deprecated Cutoff removed — returns false so callers keep working without filtering. */
export function shouldApplyNewCrmCutoffForRole(_role: string, _isNewCrm = true): boolean {
  return false;
}

/** @deprecated Cutoff removed — returns leads unchanged. */
export function applyNewCrmCutoff<T extends object>(leads: T[], _isNewCrm = true): T[] {
  return leads;
}
