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
  date: string;
  slotId: string;
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

export async function createAppointment(body: CreateAppointmentBody): Promise<CreateAppointmentResponse> {
  const res = await fetch("/api/crm/appointment", {
    method: "POST",
    credentials: "include",
    headers: authJson(),
    body: JSON.stringify(body),
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
