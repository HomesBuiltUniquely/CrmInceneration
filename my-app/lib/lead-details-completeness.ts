import type { Lead } from "@/lib/data";
import { leadHasFloorPlan } from "@/lib/floor-plan";

export type LeadCompletenessField = {
  key: string;
  label: string;
  filled: boolean;
};

export function leadCompletenessFields(lead: Lead): LeadCompletenessField[] {
  const floorPlanOk = leadHasFloorPlan(
    (lead.floorPlan ?? "").trim(),
    undefined,
    (lead.floorPlanPublicLink ?? "").trim(),
  );
  const scopeOk = Boolean(
    (lead.propertyNotes ?? "").trim() ||
      (lead.requirements ?? []).some((r) => String(r).trim()),
  );

  return [
    { key: "name", label: "Name", filled: Boolean((lead.name ?? "").trim()) },
    { key: "phone", label: "Phone", filled: Boolean((lead.phone ?? "").trim()) },
    { key: "email", label: "Email", filled: Boolean((lead.email ?? "").trim()) },
    { key: "pincode", label: "Pincode", filled: Boolean((lead.pincode ?? "").trim()) },
    {
      key: "configuration",
      label: "Configuration",
      filled: Boolean((lead.configuration ?? "").trim()),
    },
    { key: "budget", label: "Budget", filled: Boolean((lead.budget ?? "").trim()) },
    {
      key: "floorPlan",
      label: "Floor Plan",
      filled: floorPlanOk,
    },
    {
      key: "scope",
      label: "Scope of work",
      filled: scopeOk,
    },
    {
      key: "possession",
      label: "Possession Date",
      filled: Boolean((lead.possessionDate ?? "").trim()),
    },
    {
      key: "meeting",
      label: "Meeting Scheduled",
      filled: Boolean((lead.meetingDate ?? "").trim()),
    },
  ];
}

export function computeLeadDataCompleteness(lead: Lead): {
  percent: number;
  missingLabels: string[];
  fields: LeadCompletenessField[];
} {
  const fields = leadCompletenessFields(lead);
  const filled = fields.filter((f) => f.filled).length;
  const percent = fields.length ? Math.round((filled / fields.length) * 100) : 0;
  const missingLabels = fields.filter((f) => !f.filled).map((f) => f.label);
  return { percent, missingLabels, fields };
}
