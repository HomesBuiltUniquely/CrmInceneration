"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import {
  createAppointment,
  deleteAppointment,
  fetchActiveDesigners,
  fetchAvailableSlots,
  fetchMyAppointments,
  type AvailableSlotRow,
} from "@/lib/appointment-client";
import { crmLeadTypeToApiLabel } from "@/lib/crm-lead-type-label";
import type { CrmLeadType } from "@/lib/leads-filter";
import { useGlobalNotifier } from "../Shared/GlobalNotifier";

function formatDt(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  const s = String(value);
  const t = Date.parse(s);
  if (Number.isNaN(t)) return s;
  return new Date(t).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function pickStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function clientLabelFromDescription(desc: string): string {
  const m = desc.match(/Lead ID:\s*(\d+)/i);
  if (m) return `Lead #${m[1]}`;
  const m2 = desc.match(/Meeting with\s+(.+?)\s*-\s*Lead ID:/i);
  if (m2) return m2[1].trim();
  return desc.slice(0, 48) || "—";
}

type RowVM = {
  id: string;
  clientName: string;
  startTime: string;
  endTime: string;
  description: string;
  assignedTo: string;
  googleSync: string;
  raw: Record<string, unknown>;
};

function toRowVM(raw: unknown, index: number): RowVM {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const id = o.id ?? o.appointmentId ?? index;
  const description = pickStr(o, "description", "notes", "note") || "—";
  const clientName =
    pickStr(o, "clientName", "customerName", "leadName", "fullName") ||
    clientLabelFromDescription(description);
  const assignedTo = pickStr(o, "designerName", "assignedTo", "assignedToName", "userName") || "—";
  const g =
    pickStr(o, "googleSyncStatus", "googleSync", "syncStatus") ||
    (typeof o.googleSyncStatus === "string" ? o.googleSyncStatus : "");
  const googleSync = g || "—";

  return {
    id: String(id),
    clientName,
    startTime: formatDt(o.startTime ?? o.start),
    endTime: formatDt(o.endTime ?? o.end),
    description,
    assignedTo,
    googleSync,
    raw: o,
  };
}

const LEAD_TYPES: { value: CrmLeadType; label: string }[] = [
  { value: "formlead", label: "Form Lead" },
  { value: "glead", label: "G Lead" },
  { value: "mlead", label: "M Lead" },
  { value: "addlead", label: "Add Lead" },
  { value: "websitelead", label: "Website Lead" },
];

export default function AppointmentManagementClient() {
  const [role] = useState(() => {
    if (typeof window === "undefined") return "DESIGNER";
    const storedRole = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "DESIGNER";
    return normalizeRole(storedRole) || "DESIGNER";
  });
  const roleLabel = role
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const [rows, setRows] = useState<RowVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { notifySuccess, notifyError, notifyInfo } = useGlobalNotifier();

  const [leadId, setLeadId] = useState("");
  const [leadType, setLeadType] = useState<CrmLeadType>("formlead");
  const [designerName, setDesignerName] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [designers, setDesigners] = useState<string[]>([]);
  const [slots, setSlots] = useState<AvailableSlotRow[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const minDate = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchMyAppointments();
      setRows(list.map((r, i) => toRowVM(r, i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load appointments");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!createOpen) return;
    void fetchActiveDesigners()
      .then(setDesigners)
      .catch(() => setDesigners([]));
  }, [createOpen]);

  useEffect(() => {
    if (!createOpen || !designerName.trim() || !apptDate.trim()) {
      setSlots([]);
      setSlotId("");
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    void fetchAvailableSlots(apptDate.trim(), designerName.trim())
      .then((res) => {
        if (!cancelled) {
          setSlots((res.availableSlots ?? []).filter((s) => s.available !== false));
          setSlotId("");
        }
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apptDate, createOpen, designerName]);

  const handleCreate = async () => {
    const idNum = Number(leadId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      notifyInfo("Enter a valid Lead ID");
      return;
    }
    if (!designerName.trim() || !apptDate.trim() || !slotId.trim()) {
      notifyInfo("Designer, date, and slot are required");
      return;
    }
    setBusy(true);
    try {
      await createAppointment({
        designerName: designerName.trim(),
        date: apptDate.trim(),
        slotId: slotId.trim(),
        description: `Meeting with ${crmLeadTypeToApiLabel(leadType)} - Lead ID: ${idNum}`,
        leadType: crmLeadTypeToApiLabel(leadType),
        leadId: idNum,
      });
      setCreateOpen(false);
      setLeadId("");
      setSlotId("");
      notifySuccess("Appointment created");
      await load();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setBusy(true);
    try {
      await deleteAppointment(deleteId);
      setDeleteId(null);
      notifySuccess("Appointment removed");
      await load();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--crm-app-bg)] xl:h-screen xl:overflow-hidden">
      <div className="grid min-h-screen xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <QuickAccessSidebar
            appBadge="HO WS"
            appName="Hows"
            appTagline="by HUB"
            sections={dashboardSidebarSections}
            profileName={roleLabel}
            profileRole={role}
            profileInitials={roleLabel.slice(0, 2).toUpperCase()}
          />
        </div>

        <div className="bg-[var(--crm-surface)] xl:h-screen xl:overflow-y-auto">
          <div className="border-b border-[var(--crm-border)] bg-[var(--crm-surface-elevated)] shadow-[var(--crm-shadow-sm)]">
            <div className="flex min-h-16 items-center justify-between px-4 md:px-6">
              <h1 className="text-[1.35rem] font-bold tracking-[-0.03em] text-[var(--crm-text-primary)] md:text-[2rem]">
                {roleLabel} Panel
              </h1>
            </div>
          </div>

          <main className="px-4 py-6 md:px-6">
            <section className="mx-auto max-w-[1200px] rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[var(--crm-border)] dark:bg-[var(--crm-surface)]">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-4 dark:border-[var(--crm-border)] md:px-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-xl dark:bg-rose-950/40">
                  📅
                </span>
                <h2 className="text-lg font-bold text-slate-800 dark:text-[var(--crm-text-primary)] md:text-xl">
                  Appointment Management
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-4 dark:border-[var(--crm-border)] md:px-6">
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:opacity-50"
                  disabled={busy}
                >
                  <span className="text-lg leading-none">+</span>
                  Create Appointment
                </button>
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading || busy}
                  className="inline-flex items-center rounded-lg border border-[#2563eb] bg-white px-4 py-2.5 text-sm font-semibold text-[#2563eb] transition hover:bg-slate-50 dark:border-[var(--crm-accent)] dark:bg-[var(--crm-surface-subtle)] dark:text-[var(--crm-accent)] dark:hover:bg-[var(--crm-surface)]"
                >
                  {loading ? "Loading…" : "Refresh"}
                </button>
                <Link
                  href="/Leads"
                  className="ml-auto text-sm font-medium text-[#2563eb] underline-offset-2 hover:underline dark:text-[var(--crm-accent)]"
                >
                  Open Leads (schedule from lead)
                </Link>
              </div>

              {error ? (
                <p className="px-4 py-3 text-sm text-rose-600 md:px-6">{error}</p>
              ) : null}

              <div className="overflow-x-auto px-2 pb-6 pt-2 md:px-4">
                <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-[var(--crm-border)] dark:bg-[var(--crm-surface-subtle)] dark:text-[var(--crm-text-muted)]">
                      <th className="whitespace-nowrap px-3 py-3 font-semibold">Client Name</th>
                      <th className="whitespace-nowrap px-3 py-3 font-semibold">Start Time</th>
                      <th className="whitespace-nowrap px-3 py-3 font-semibold">End Time</th>
                      <th className="min-w-[140px] px-3 py-3 font-semibold">Description</th>
                      <th className="whitespace-nowrap px-3 py-3 font-semibold">Assigned To</th>
                      <th className="whitespace-nowrap px-3 py-3 font-semibold">Google Sync</th>
                      <th className="whitespace-nowrap px-3 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                          Loading appointments…
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-12 text-center text-slate-400 dark:text-[var(--crm-text-muted)]">
                          No appointments found
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-slate-100 dark:border-[var(--crm-border)]"
                        >
                          <td className="px-3 py-3 font-medium text-slate-800 dark:text-[var(--crm-text-primary)]">
                            {r.clientName}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-[var(--crm-text-secondary)]">
                            {r.startTime}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-[var(--crm-text-secondary)]">
                            {r.endTime}
                          </td>
                          <td className="max-w-[220px] truncate px-3 py-3 text-slate-600 dark:text-[var(--crm-text-secondary)]" title={r.description}>
                            {r.description}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-[var(--crm-text-secondary)]">
                            {r.assignedTo}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                String(r.googleSync).toUpperCase().includes("SUCCESS")
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                                  : "bg-slate-100 text-slate-600 dark:bg-[var(--crm-surface-subtle)] dark:text-[var(--crm-text-muted)]"
                              }`}
                            >
                              {r.googleSync}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <button
                              type="button"
                              onClick={() => setDeleteId(r.id)}
                              className="text-sm font-medium text-rose-600 hover:underline"
                              disabled={busy}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </div>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5 shadow-[var(--crm-shadow-lg)]">
            <h3 className="text-lg font-bold text-[var(--crm-text-primary)]">Create appointment</h3>
            <p className="mt-1 text-[12px] text-[var(--crm-text-muted)]">
              Tie to a lead: description will be{" "}
              <code className="rounded bg-[var(--crm-surface-subtle)] px-1">Meeting with [type] - Lead ID: [id]</code>
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[12px] font-semibold text-[var(--crm-text-secondary)]">Lead ID</label>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-input-bg)] px-3 py-2 text-sm"
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  placeholder="e.g. 452"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[var(--crm-text-secondary)]">Lead type</label>
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-input-bg)] px-3 py-2 text-sm"
                  value={leadType}
                  onChange={(e) => setLeadType(e.target.value as CrmLeadType)}
                >
                  {LEAD_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[var(--crm-text-secondary)]">Designer</label>
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-input-bg)] px-3 py-2 text-sm"
                  value={designerName}
                  onChange={(e) => setDesignerName(e.target.value)}
                >
                  <option value="">Select designer</option>
                  {designers.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[var(--crm-text-secondary)]">Date</label>
                <input
                  type="date"
                  min={minDate}
                  className="mt-1 w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-input-bg)] px-3 py-2 text-sm"
                  value={apptDate}
                  onChange={(e) => setApptDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[var(--crm-text-secondary)]">Slot</label>
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-input-bg)] px-3 py-2 text-sm"
                  value={slotId}
                  onChange={(e) => setSlotId(e.target.value)}
                  disabled={slotsLoading || !slots.length}
                >
                  <option value="">{slotsLoading ? "Loading slots…" : slots.length ? "Select slot" : "Pick designer & date"}</option>
                  {slots.map((s) => (
                    <option key={s.slotId} value={s.slotId}>
                      {s.displayName ?? s.slotId}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-[var(--crm-border)] px-4 py-2 text-sm font-medium text-[var(--crm-text-primary)]"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={busy}
                className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                {busy ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteId ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5 shadow-[var(--crm-shadow-lg)]">
            <p className="text-sm font-semibold text-[var(--crm-text-primary)]">Delete this appointment?</p>
            <p className="mt-1 text-[12px] text-[var(--crm-text-muted)]">This removes the Hub booking (and may remove the Google event).</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-[var(--crm-border)] px-4 py-2 text-sm"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={busy}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {busy ? "…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
