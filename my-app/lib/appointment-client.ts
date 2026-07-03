import { getCrmAuthHeaders } from "@/lib/crm-client-auth";

function authJson(): HeadersInit {
  return getCrmAuthHeaders({ "Content-Type": "application/json", Accept: "application/json" });
}

export type AppointmentSlotDef = {
  slotId?: string;
  displayName?: string;
  startTime?: string;
  durationMinutes?: number;
};

export type AvailableSlotRow = {
  slotId: string;
  displayName?: string;
  startTime?: string;
  durationMinutes?: number;
  available?: boolean;
};

export type AvailableSlotsResponse = {
  date?: string;
  designerName?: string;
  availableSlots?: AvailableSlotRow[];
};

export type CreateAppointmentBody = {
  designerName: string;
  date?: string;
  slotId?: string;
  startTime?: string;
  endTime?: string;
  meetingType?: "SHOWROOM_VISIT" | "VIRTUAL_MEETING" | "SITE_VISIT";
  description: string;
  leadType: string;
  leadId: number;
};

export type CreateAppointmentResponse = {
  id?: number;
  designerName?: string;
  date?: string;
  slotId?: string;
  meetingType?: "SHOWROOM_VISIT" | "VIRTUAL_MEETING" | "SITE_VISIT";
  slotDisplayName?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  googleSyncStatus?: string;
  googleHtmlLink?: string;
  error?: string;
  details?: string;
};

export async function fetchAppointmentSlotCatalog(): Promise<AppointmentSlotDef[]> {
  const res = await fetch("/api/crm/appointment/slots", {
    cache: "no-store",
    credentials: "include",
    headers: authJson(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  const data = JSON.parse(text) as unknown;
  return Array.isArray(data) ? data : [];
}

export async function fetchAvailableSlots(date: string, designerName: string): Promise<AvailableSlotsResponse> {
  const qs = new URLSearchParams();
  qs.set("date", date);
  qs.set("designerName", designerName);
  const res = await fetch(`/api/crm/appointment/available-slots?${qs.toString()}`, {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return JSON.parse(text) as AvailableSlotsResponse;
}

export type DesignModuleDesigner = {
  id: number;
  name: string;
  email: string;
};

/**
 * Fetch designers from Design Module (single source of truth).
 * Returns { id, name, email } — name for slot matching, email for Google Calendar.
 * Route returns empty list (not an error) when Design Module is unreachable.
 */
export async function fetchDesignersFromDesignModule(): Promise<DesignModuleDesigner[]> {
  console.log("[fetchDesignersFromDesignModule] calling /api/crm/designers");
  const res = await fetch("/api/crm/designers", {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  const text = await res.text();
  console.log(`[fetchDesignersFromDesignModule] status=${res.status} body=${text.slice(0, 300)}`);
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("[fetchDesignersFromDesignModule] JSON parse failed:", text.slice(0, 200));
    return [];
  }
  if (
    data &&
    typeof data === "object" &&
    "designers" in data &&
    Array.isArray((data as { designers: unknown }).designers)
  ) {
    const list = (data as { designers: DesignModuleDesigner[] }).designers;
    console.log(`[fetchDesignersFromDesignModule] got ${list.length} designers`);
    return list;
  }
  console.warn("[fetchDesignersFromDesignModule] unexpected response shape:", JSON.stringify(data).slice(0, 200));
  return [];
}

export async function fetchActiveDesigners(): Promise<string[]> {
  const res = await fetch("/api/crm/appointment/designer-list/active", {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  const data = JSON.parse(text) as unknown;
  if (Array.isArray(data)) {
    return data
      .map((x) => {
        if (typeof x === "string") return x.trim();
        if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          const n = o.fullName ?? o.name ?? o.designerName ?? o.username;
          if (typeof n === "string" && n.trim()) return n.trim();
        }
        return "";
      })
      .filter(Boolean);
  }
  if (data && typeof data === "object" && "designers" in data && Array.isArray((data as { designers: unknown }).designers)) {
    return ((data as { designers: unknown[] }).designers).map((x) => String(x)).filter(Boolean);
  }
  return [];
}

/** Raw list from GET /v1/Appointment (designer’s appointments). */
export async function fetchMyAppointments(): Promise<unknown[]> {
  const res = await fetch("/api/crm/appointment", {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    throw new Error(text || "Invalid JSON");
  }
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.content)) return o.content;
    if (Array.isArray(o.appointments)) return o.appointments;
    if (Array.isArray(o.data)) return o.data;
  }
  return [];
}

export async function deleteAppointment(id: number | string): Promise<void> {
  const res = await fetch(`/api/crm/appointment/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
}

export async function fetchDesignerAppointments(designerName: string): Promise<unknown[]> {
  const res = await fetch(`/api/crm/appointment/designer/${encodeURIComponent(designerName)}`, {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    throw new Error(text || "Invalid JSON");
  }
  return Array.isArray(data) ? data : [];
}

export async function createAppointment(body: CreateAppointmentBody): Promise<CreateAppointmentResponse> {
  const payload: Record<string, unknown> = {
    designerName: body.designerName,
    description: body.description,
    leadType: body.leadType,
    leadId: body.leadId,
  };
  if (body.meetingType) payload.meetingType = body.meetingType;
  if (body.startTime && body.endTime) {
    payload.startTime = body.startTime;
    payload.endTime = body.endTime;
  } else if (body.date && body.slotId) {
    payload.date = body.date;
    payload.slotId = body.slotId;
  }
  const res = await fetch("/api/crm/appointment", {
    method: "POST",
    credentials: "include",
    headers: authJson(),
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: CreateAppointmentResponse = {};
  try {
    parsed = JSON.parse(text) as CreateAppointmentResponse;
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    throw new Error(parsed.error ?? text ?? `HTTP ${res.status}`);
  }
  if (parsed.error) {
    throw new Error(parsed.error);
  }
  return parsed;
}

export type AppointmentRow = {
  id?: number;
  leadId?: number;
  meetingType?: string;
  startTime?: string;
  endTime?: string;
  createdAt?: string;
  designerName?: string;
};

function readAppointmentField(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return undefined;
}

function extractLeadIdFromDescription(description: string): number | undefined {
  const match = description.match(/Lead ID:\s*([^\s,;]+)/i);
  if (!match?.[1]) return undefined;
  const parsed = Number(match[1].trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeAppointmentRow(row: unknown): AppointmentRow | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;

  let leadIdRaw = readAppointmentField(o, "leadId", "LeadId", "lead_id");
  if (leadIdRaw == null) {
    const description = readAppointmentField(o, "description", "Description");
    if (typeof description === "string") {
      leadIdRaw = extractLeadIdFromDescription(description);
    }
  }
  const leadId =
    leadIdRaw == null
      ? undefined
      : typeof leadIdRaw === "number"
        ? leadIdRaw
        : Number(String(leadIdRaw).trim());

  const meetingTypeRaw = readAppointmentField(
    o,
    "meetingType",
    "MeetingType",
    "meeting_type",
  );
  const createdAtRaw = readAppointmentField(o, "createdAt", "CreatedAt", "created_at");
  const startTimeRaw = readAppointmentField(o, "startTime", "StartTime", "start_time");
  const designerNameRaw = readAppointmentField(o, "designerName", "DesignerName", "designer_name");

  return {
    id:
      typeof o.id === "number"
        ? o.id
        : typeof readAppointmentField(o, "Id", "ID") === "number"
          ? (readAppointmentField(o, "Id", "ID") as number)
          : undefined,
    leadId: Number.isFinite(leadId) ? leadId : undefined,
    meetingType:
      typeof meetingTypeRaw === "string" && meetingTypeRaw.trim()
        ? meetingTypeRaw.trim()
        : undefined,
    startTime: typeof startTimeRaw === "string" ? startTimeRaw : undefined,
    endTime:
      typeof readAppointmentField(o, "endTime", "EndTime", "end_time") === "string"
        ? (readAppointmentField(o, "endTime", "EndTime", "end_time") as string)
        : undefined,
    createdAt: typeof createdAtRaw === "string" ? createdAtRaw : undefined,
    designerName:
      typeof designerNameRaw === "string" && designerNameRaw.trim()
        ? designerNameRaw.trim()
        : undefined,
  };
}

function parseAppointmentRows(data: unknown): AppointmentRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => normalizeAppointmentRow(row))
    .filter((row): row is AppointmentRow => row !== null);
}

function appointmentMatchesLead(row: AppointmentRow, leadId: number | string): boolean {
  const target = String(leadId).trim();
  if (!target || row.leadId == null) return false;
  return String(row.leadId) === target;
}

function pickLatestAppointmentForLead(
  rows: AppointmentRow[],
  leadId: number | string,
): AppointmentRow | null {
  const matches = rows.filter((row) => appointmentMatchesLead(row, leadId));
  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const aKey = String(a.createdAt ?? a.startTime ?? "");
    const bKey = String(b.createdAt ?? b.startTime ?? "");
    return bKey.localeCompare(aKey);
  });

  return matches[0] ?? null;
}

/** Existing API: GET /v1/Appointment/designer/{designerName} */
export async function fetchAppointmentsByDesigner(designerName: string): Promise<AppointmentRow[]> {
  const name = designerName.trim();
  if (!name) return [];

  const res = await fetch(`/api/crm/appointment/designer/${encodeURIComponent(name)}`, {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  const text = await res.text();
  if (!res.ok) return [];

  try {
    return parseAppointmentRows(JSON.parse(text));
  } catch {
    return [];
  }
}

/** UI placeholders like "—" are not real designer names for appointment lookup. */
export function normalizeDesignerNameForAppointmentLookup(name?: string): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (
    trimmed === "—" ||
    trimmed === "-" ||
    trimmed === "–" ||
    lower === "n/a" ||
    lower === "na" ||
    lower === "none" ||
    lower === "not assigned" ||
    lower === "unassigned"
  ) {
    return "";
  }
  return trimmed;
}

/**
 * Resolve meeting type from existing appointment GET APIs (no dedicated lead endpoint).
 * Prefers designer-scoped list when designerName is known; otherwise GET /v1/Appointment.
 */
export async function resolveMeetingTypeForLead(
  leadId: number | string,
  options: { designerName?: string } = {},
): Promise<string | null> {
  const ctx = await resolveAppointmentContextForLead(leadId, options);
  return ctx.meetingType;
}

export type AppointmentContextForLead = {
  meetingType: string | null;
  designerName: string | null;
};

/**
 * Resolve meeting type + designer from appointment GET APIs (no dedicated lead endpoint).
 * Prefers designer-scoped list when designerName is known; otherwise GET /v1/Appointment.
 */
export async function resolveAppointmentContextForLead(
  leadId: number | string,
  options: { designerName?: string } = {},
): Promise<AppointmentContextForLead> {
  const designerName = normalizeDesignerNameForAppointmentLookup(options.designerName);
  let rows: AppointmentRow[] = [];
  if (designerName) {
    rows = await fetchAppointmentsByDesigner(designerName);
  }
  let latest = pickLatestAppointmentForLead(rows, leadId);
  if (!latest) {
    rows = parseAppointmentRows(await fetchMyAppointments());
    latest = pickLatestAppointmentForLead(rows, leadId);
  }
  return {
    meetingType: latest?.meetingType?.trim() || null,
    designerName: latest?.designerName?.trim() || null,
  };
}
