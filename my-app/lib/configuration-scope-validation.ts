import type { ConfigurationScopeRequirements, ScopeSelectedRoom } from "@/lib/configuration-scope-client";
import type { Lead } from "@/lib/data";
import { REQUIRED_FIELD_HINTS } from "@/lib/required-field-hints";

export const MODULAR_KITCHEN_ROOM_NAME = "Modular Kitchen";

export type ConfigurationScopeSectionId = "basic-understanding" | "requirements";

export type ConfigurationScopeFieldKey =
  | "propertyName"
  | "configuration"
  | "bookingType"
  | "expectedTimeline"
  | "rooms"
  | "roomsExtra"
  | "floorPlan"
  | `roomUnits:${string}`
  | `roomNotes:${string}`;

export type ConfigurationScopeValidationIssue = {
  key: ConfigurationScopeFieldKey;
  message: string;
  sectionId: ConfigurationScopeSectionId;
  roomId?: string;
};

export type ConfigurationScopeValidationInput = {
  requirements: ConfigurationScopeRequirements;
  /** BHK type from lead detail / Configuration Scope form. */
  configuration: string | null | undefined;
  /** Optional override when form local state differs from requirements. */
  bookingType?: string | null | undefined;
  hasFloorPlan: boolean;
};

const MIN_UNITS_PER_ROOM = 2;

function isFilled(value: string | null | undefined): boolean {
  return String(value ?? "").trim().length > 0;
}

function selectedUnitCount(room: ScopeSelectedRoom): number {
  return (room.units ?? []).filter((unit) => unit.selected && unit.label.trim()).length;
}

function isModularKitchen(room: ScopeSelectedRoom): boolean {
  return room.roomName.trim().toLowerCase() === MODULAR_KITCHEN_ROOM_NAME.toLowerCase();
}

export function hasLeadFloorPlan(lead: Pick<Lead, "floorPlan" | "floorPlanPublicLink" | "floorPlanViewPath">): boolean {
  return Boolean(
    lead.floorPlan?.trim() ||
      lead.floorPlanPublicLink?.trim() ||
      lead.floorPlanViewPath?.trim(),
  );
}

/**
 * Full gate for Finalize + Meeting Scheduled / Schedule Hub Meeting:
 * Basic Understanding (4 fields), rooms (≥1 extra beside Modular Kitchen when present,
 * each room ≥2 units + notes), and floor plan.
 */
export function validateConfigurationScopeForMeeting(
  input: ConfigurationScopeValidationInput,
): ConfigurationScopeValidationIssue[] {
  const issues: ConfigurationScopeValidationIssue[] = [];
  const rooms = input.requirements.selectedRooms ?? [];
  const bookingType =
    input.bookingType !== undefined
      ? input.bookingType
      : input.requirements.bookingType;

  if (!isFilled(input.requirements.propertyName)) {
    issues.push({
      key: "propertyName",
      message: REQUIRED_FIELD_HINTS.propertyName,
      sectionId: "basic-understanding",
    });
  }

  if (!isFilled(input.configuration)) {
    issues.push({
      key: "configuration",
      message: REQUIRED_FIELD_HINTS.bhkType,
      sectionId: "basic-understanding",
    });
  }

  if (!isFilled(bookingType)) {
    issues.push({
      key: "bookingType",
      message: REQUIRED_FIELD_HINTS.scopeBookingType,
      sectionId: "basic-understanding",
    });
  }

  if (!isFilled(input.requirements.expectedTimeline)) {
    issues.push({
      key: "expectedTimeline",
      message: REQUIRED_FIELD_HINTS.expectedTimeline,
      sectionId: "basic-understanding",
    });
  }

  if (rooms.length === 0) {
    issues.push({
      key: "rooms",
      message: REQUIRED_FIELD_HINTS.rooms,
      sectionId: "requirements",
    });
  } else {
    const hasModularKitchen = rooms.some(isModularKitchen);
    const otherRooms = rooms.filter((room) => !isModularKitchen(room));
    if (hasModularKitchen && otherRooms.length === 0) {
      issues.push({
        key: "roomsExtra",
        message: REQUIRED_FIELD_HINTS.roomsExtra,
        sectionId: "requirements",
      });
    }

    for (const room of rooms) {
      const roomName = room.roomName?.trim() || "Selected room";
      const roomId = room.id || roomName;
      const unitCount = selectedUnitCount(room);
      if (unitCount < MIN_UNITS_PER_ROOM) {
        issues.push({
          key: `roomUnits:${roomId}`,
          message: `${roomName}: ${REQUIRED_FIELD_HINTS.roomUnits}`,
          sectionId: "requirements",
          roomId,
        });
      }
      if (!isFilled(room.notes)) {
        issues.push({
          key: `roomNotes:${roomId}`,
          message: `${roomName}: ${REQUIRED_FIELD_HINTS.roomNotes}`,
          sectionId: "requirements",
          roomId,
        });
      }
    }
  }

  if (!input.hasFloorPlan) {
    issues.push({
      key: "floorPlan",
      message: REQUIRED_FIELD_HINTS.floorPlan,
      sectionId: "requirements",
    });
  }

  return issues;
}

export function configurationScopeValidationSummary(
  issues: ConfigurationScopeValidationIssue[],
): string {
  if (issues.length === 0) return "";
  if (issues.length === 1) return issues[0].message;
  return `A few details still need your care (${issues.length}). We’ll open Configuration Scope so you can finish them with ease.`;
}

export function firstMissingFieldMessage(
  issues: ConfigurationScopeValidationIssue[],
): string | null {
  return issues[0]?.message ?? null;
}

export function isConfigurationScopeReadyForMeeting(
  input: ConfigurationScopeValidationInput,
): boolean {
  return validateConfigurationScopeForMeeting(input).length === 0;
}

export function issueKeys(issues: ConfigurationScopeValidationIssue[]): Set<string> {
  return new Set(issues.map((issue) => issue.key));
}

/** High-level checklist for Scope of Work UI. */
export type ScopeMeetingChecklistItem = {
  id: string;
  label: string;
  complete: boolean;
  /** Meeting Scheduled cannot proceed until these are done. */
  mandatory: boolean;
};

/**
 * Checklist for the circular completion meter on Configure Scope.
 * Mandatory items gate Meeting Scheduled; recommended items keep % honest
 * when the form still has empty sections.
 */
export function buildConfigurationScopeMeetingChecklist(
  input: ConfigurationScopeValidationInput,
): ScopeMeetingChecklistItem[] {
  const issues = validateConfigurationScopeForMeeting(input);
  const keys = issueKeys(issues);
  const roomsIncomplete = keys.has("rooms") || keys.has("roomsExtra");
  const roomDetailsPending = [...keys].some(
    (key) => key.startsWith("roomUnits:") || key.startsWith("roomNotes:"),
  );
  const req = input.requirements;
  const hasFamilyContact =
    isFilled(req.familyContactName) || isFilled(req.familyContactPhone);

  return [
    {
      id: "propertyName",
      label: "Property name",
      complete: !keys.has("propertyName"),
      mandatory: true,
    },
    {
      id: "configuration",
      label: "BHK type",
      complete: !keys.has("configuration"),
      mandatory: true,
    },
    {
      id: "bookingType",
      label: "Type",
      complete: !keys.has("bookingType"),
      mandatory: true,
    },
    {
      id: "expectedTimeline",
      label: "Timeline",
      complete: !keys.has("expectedTimeline"),
      mandatory: true,
    },
    {
      id: "rooms",
      label: "Rooms",
      complete: !roomsIncomplete,
      mandatory: true,
    },
    {
      id: "roomDetails",
      label: "Room details",
      // No rooms yet → details are also pending (do not mark complete by default).
      complete: !roomsIncomplete && !roomDetailsPending,
      mandatory: true,
    },
    {
      id: "floorPlan",
      label: "Floor plan",
      complete: !keys.has("floorPlan"),
      mandatory: true,
    },
    {
      id: "kitchenLayout",
      label: "Kitchen layout",
      complete: isFilled(req.kitchenLayout),
      mandatory: false,
    },
    {
      id: "materialFinish",
      label: "Material / finish",
      complete: isFilled(req.materialFinish),
      mandatory: false,
    },
    {
      id: "familyContact",
      label: "Family contact",
      complete: hasFamilyContact,
      mandatory: false,
    },
    {
      id: "designStyle",
      label: "Design style",
      complete: isFilled(req.designStylePreference),
      mandatory: false,
    },
    {
      id: "projectUnderstanding",
      label: "Project notes",
      complete: isFilled(req.projectUnderstanding),
      mandatory: false,
    },
  ];
}

export function configurationScopeMeetingCompletion(
  input: ConfigurationScopeValidationInput,
): {
  percent: number;
  items: ScopeMeetingChecklistItem[];
  pendingLabels: string[];
  pendingMandatoryLabels: string[];
  /** True only when Meeting Scheduled gate passes. */
  ready: boolean;
  mandatoryDone: number;
  mandatoryTotal: number;
} {
  const items = buildConfigurationScopeMeetingChecklist(input);
  const completeCount = items.filter((item) => item.complete).length;
  const percent =
    items.length === 0 ? 0 : Math.round((completeCount / items.length) * 100);
  const mandatoryItems = items.filter((item) => item.mandatory);
  const mandatoryDone = mandatoryItems.filter((item) => item.complete).length;
  const ready = isConfigurationScopeReadyForMeeting(input);
  return {
    percent,
    items,
    pendingLabels: items.filter((item) => !item.complete).map((item) => item.label),
    pendingMandatoryLabels: mandatoryItems
      .filter((item) => !item.complete)
      .map((item) => item.label),
    ready,
    mandatoryDone,
    mandatoryTotal: mandatoryItems.length,
  };
}
