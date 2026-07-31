"use client";

/**
 * Lead-detail sections register pending flush handlers while edit mode is dirty.
 * Overlay close runs them so forgotten Done-clicks still persist field changes.
 */

export type LeadDetailPendingFlush = () => Promise<string[]>;

const pendingFlushes = new Set<LeadDetailPendingFlush>();

export function registerLeadDetailPendingFlush(fn: LeadDetailPendingFlush): () => void {
  pendingFlushes.add(fn);
  return () => {
    pendingFlushes.delete(fn);
  };
}

export async function flushLeadDetailPendingSaves(): Promise<string[]> {
  const fns = [...pendingFlushes];
  const labels: string[] = [];
  for (const fn of fns) {
    try {
      const next = await fn();
      for (const label of next) {
        if (label && !labels.includes(label)) labels.push(label);
      }
    } catch {
      /* keep trying remaining flushes; caller may still close */
    }
  }
  return labels;
}

export function discoveryFieldLabels(
  before: Record<string, string | undefined | null>,
  after: Record<string, string | undefined | null>,
): string[] {
  const map: Record<string, string> = {
    propertyLocation: "Property name",
    budget: "Budget range",
    language: "Language preferred",
    configuration: "Configuration",
    propertyNotes: "Property notes",
    bookingType: "Type",
    name: "Name",
    phone: "Phone",
    email: "Email",
    familyContactName: "Family contact name",
    familyContactPhone: "Family contact phone",
    familyContactRelationship: "Family contact relationship",
  };
  const out: string[] = [];
  for (const [key, label] of Object.entries(map)) {
    const a = String(before[key] ?? "").trim();
    const b = String(after[key] ?? "").trim();
    if (a !== b) out.push(label);
  }
  return out;
}
