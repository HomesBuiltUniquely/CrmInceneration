import type { Lead } from "@/lib/data";
import { missingLeadPropertyGateFields } from "@/lib/milestone-advance-gates";

export type CompletenessItem = {
  id: string;
  label: string;
  complete: boolean;
  scrollTargetId?: string;
};

function isFilled(value: string | null | undefined): boolean {
  return String(value ?? "").trim().length > 0;
}

function hasFloorPlan(lead: Lead): boolean {
  return Boolean(
    lead.floorPlan?.trim() ||
      lead.floorPlanPublicLink?.trim() ||
      lead.floorPlanViewPath?.trim(),
  );
}

export function buildLeadDataCompletenessItems(
  lead: Lead,
  options: { scopeOfWorkComplete?: boolean } = {},
): CompletenessItem[] {
  const gateMissing = new Set(missingLeadPropertyGateFields(lead));

  return [
    {
      id: "phone",
      label: "Phone",
      complete: isFilled(lead.phone),
      scrollTargetId: "deal-overview",
    },
    {
      id: "email",
      label: "Email",
      complete: isFilled(lead.email),
      scrollTargetId: "deal-overview",
    },
    {
      id: "location",
      label: "Pincode",
      complete: isFilled(lead.pincode) || isFilled(lead.propertyLocation),
      scrollTargetId: "deal-overview",
    },
    {
      id: "budget",
      label: "Budget",
      complete: !gateMissing.has("Budget"),
      scrollTargetId: "deal-property",
    },
    {
      id: "configuration",
      label: "Configuration",
      complete: !gateMissing.has("Configuration"),
      scrollTargetId: "deal-property",
    },
    {
      id: "booking-type",
      label: "Booking type",
      complete: !gateMissing.has("Booking type"),
      scrollTargetId: "deal-property",
    },
    {
      id: "floor-plan",
      label: "Floor Plan",
      complete: hasFloorPlan(lead),
      scrollTargetId: "deal-connection-floor-plan",
    },
    {
      id: "scope-of-work",
      label: "Scope of work",
      complete: Boolean(options.scopeOfWorkComplete),
      scrollTargetId: "deal-scope-of-work",
    },
  ];
}

export function computeLeadDataCompleteness(
  lead: Lead,
  options: { scopeOfWorkComplete?: boolean } = {},
): {
  percent: number;
  items: CompletenessItem[];
  missingLabels: string[];
} {
  const items = buildLeadDataCompletenessItems(lead, options);
  const completeCount = items.filter((item) => item.complete).length;
  const percent =
    items.length === 0 ? 0 : Math.round((completeCount / items.length) * 100);
  const missingLabels = items.filter((item) => !item.complete).map((item) => item.label);

  return { percent, items, missingLabels };
}
