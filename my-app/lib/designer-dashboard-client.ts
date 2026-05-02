"use client";

import {
  CRM_DESIGNER_ID_STORAGE_KEY,
  CRM_DESIGNER_NAME_STORAGE_KEY,
  getMe,
  unwrapAuthUserPayload,
} from "@/lib/auth/api";
import { getCrmAuthHeaders, readStoredCrmToken } from "@/lib/crm-client-auth";
import type { CrmLeadType } from "@/lib/leads-filter";
import { fetchMyAppointments } from "@/lib/appointment-client";

export type DesignerQueueLeadRow = {
  id: string;
  leadId?: string;
  name: string;
  leadType: CrmLeadType;
  milestoneStage?: string;
  milestoneStageCategory?: string;
  milestoneSubStage?: string;
  href: string;
};

function pickStr(o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Parses `GET …/designer-list/active` into `{ id?, name }[]` for matching `designerId`. */
export async function fetchActiveDesignerRecords(): Promise<
  Array<{ id?: number; name: string }>
> {
  const res = await fetch("/api/crm/appointment/designer-list/active", {
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
    return [];
  }
  const out: Array<{ id?: number; name: string }> = [];
  if (Array.isArray(data)) {
    for (const x of data) {
      if (typeof x === "string" && x.trim()) {
        out.push({ name: x.trim() });
        continue;
      }
      if (x && typeof x === "object" && !Array.isArray(x)) {
        const o = x as Record<string, unknown>;
        const idRaw = o.id ?? o.designerId;
        const id = typeof idRaw === "number" ? idRaw : Number(idRaw);
        const name = pickStr(o, "fullName", "name", "designerName", "username");
        if (name) out.push({ name, id: Number.isFinite(id) ? id : undefined });
      }
    }
  }
  return out;
}

/**
 * Resolves `designerName` for dashboard APIs: localStorage → `GET /api/auth/me` →
 * match `designerId` against `designer-list/active` (legacy `loadDesignerDashboard` parity).
 */
export async function resolveDesignerDisplayName(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const cached = window.localStorage.getItem(CRM_DESIGNER_NAME_STORAGE_KEY)?.trim();
  if (cached) return cached;

  const token = readStoredCrmToken();
  if (!token) return null;

  try {
    const raw = await getMe(token);
    const user = unwrapAuthUserPayload(raw);
    const fromMe = pickStr(user, "designerName", "designer_name");
    if (fromMe) {
      window.localStorage.setItem(CRM_DESIGNER_NAME_STORAGE_KEY, fromMe);
      const did = user.designerId ?? user.designer_id;
      if (did != null) {
        window.localStorage.setItem(CRM_DESIGNER_ID_STORAGE_KEY, String(did));
      }
      return fromMe;
    }

    const idRaw = user.designerId ?? user.designer_id;
    if (idRaw != null) {
      const want = Number(idRaw);
      if (Number.isFinite(want)) {
        const rows = await fetchActiveDesignerRecords();
        const match = rows.find((r) => r.id === want);
        if (match?.name) {
          window.localStorage.setItem(CRM_DESIGNER_NAME_STORAGE_KEY, match.name);
          return match.name;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function fetchDesignerLeadsBundle(
  designerName: string
): Promise<unknown> {
  const enc = encodeURIComponent(designerName.trim());
  const res = await fetch(`/api/crm/appointment/designer/${enc}/leads`, {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return text ? JSON.parse(text) : {};
}

export function flattenDesignerLeadsBundle(data: unknown): DesignerQueueLeadRow[] {
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  const out: DesignerQueueLeadRow[] = [];

  const buckets: [string, CrmLeadType][] = [
    ["formLeads", "formlead"],
    ["mleads", "mlead"],
    ["gleads", "glead"],
    ["addLeads", "addlead"],
  ];

  for (const [key, leadType] of buckets) {
    const arr = o[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const row = normalizeQueueLead(item, leadType);
      if (row) out.push(row);
    }
  }
  return out;
}

function normalizeQueueLead(
  item: unknown,
  leadType: CrmLeadType
): DesignerQueueLeadRow | null {
  if (!item || typeof item !== "object") return null;
  const r = item as Record<string, unknown>;
  const idRaw = r.id ?? r.lead_id;
  if (idRaw == null) return null;
  const id = String(idRaw);
  const stage =
    r.stage && typeof r.stage === "object"
      ? (r.stage as Record<string, unknown>)
      : undefined;
  const leadIdRaw = r.leadId ?? r.lead_id ?? r.businessLeadId;
  const name =
    pickStr(r, "name", "customerName", "fullName") ||
    pickStr(r as Record<string, unknown>, "title") ||
    "—";
  return {
    id,
    leadId: leadIdRaw != null ? String(leadIdRaw) : undefined,
    name,
    leadType,
    milestoneStage: stage ? pickStr(stage, "milestoneStage", "milestone_stage") : undefined,
    milestoneStageCategory: stage
      ? pickStr(stage, "milestoneStageCategory", "milestone_stage_category")
      : undefined,
    milestoneSubStage: stage
      ? pickStr(stage, "milestoneSubStage", "milestone_sub_stage")
      : undefined,
    href: `/Leads/${leadType}/${id}`,
  };
}

export type NormalizedAppointmentRow = {
  id?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  date?: string;
  slotDisplayName?: string;
  raw: unknown;
};

export async function fetchDesignerMyAppointmentsNormalized(): Promise<NormalizedAppointmentRow[]> {
  const rawList = await fetchMyAppointments();
  if (!Array.isArray(rawList)) return [];
  return rawList.map((raw) => {
    const o =
      raw && typeof raw === "object"
        ? (raw as Record<string, unknown>)
        : {};
    const id = o.id != null ? String(o.id) : undefined;
    const startTime = typeof o.startTime === "string" ? o.startTime : undefined;
    const endTime = typeof o.endTime === "string" ? o.endTime : undefined;
    const description = typeof o.description === "string" ? o.description : undefined;
    const date = typeof o.date === "string" ? o.date : undefined;
    const slotDisplayName =
      typeof o.slotDisplayName === "string" ? o.slotDisplayName : undefined;
    return { id, startTime, endTime, description, date, slotDisplayName, raw };
  });
}

export function countUpcomingAppointments(
  rows: NormalizedAppointmentRow[],
  fromDate: Date
): number {
  const t = fromDate.getTime();
  let n = 0;
  for (const r of rows) {
    const iso = r.startTime ?? r.date;
    if (!iso) continue;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime()) && d.getTime() >= t) n += 1;
  }
  return n;
}
