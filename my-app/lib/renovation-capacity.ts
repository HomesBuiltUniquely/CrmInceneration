/** Toast when Complete Task → Renovation cannot auto-assign (empty pool / all at limit). */
export const NO_RENOVATION_CAPACITY_TOAST =
  "No renovation capacity. Raise a limit in Admin Panel → Lead Limits → Renovation, then retry.";

export function textMentionsNoRenovationCapacity(text: string): boolean {
  return /no\s+renovation\s+capacity/i.test(text);
}

/** Detect Hub “Renovation Assignment” failure text on activity rows. */
export function activitiesMentionNoRenovationCapacity(
  activities: Array<{
    description?: string;
    note?: string;
    change?: { old?: string; new?: string };
  }>,
): boolean {
  return activities.some((activity) =>
    textMentionsNoRenovationCapacity(
      [activity.description, activity.note, activity.change?.new, activity.change?.old]
        .filter(Boolean)
        .join(" "),
    ),
  );
}

export function resolveRenovationAssignToast(args: {
  renovationAssigned: boolean;
  assignee?: string | null;
  renovationSalesExecutive?: string | null;
  renovationSalesManager?: string | null;
  activityHintsNoCapacity?: boolean;
}): { kind: "success" | "error"; message: string } {
  const mgr = (args.renovationSalesManager ?? "").trim();
  const exec =
    (args.renovationSalesExecutive ?? "").trim() ||
    (args.assignee ?? "").trim();
  const execMissing = !exec || /^[-–—]+$/.test(exec);

  if (args.renovationAssigned) {
    return {
      kind: "success",
      message: execMissing
        ? `Assigned to renovation team${mgr ? ` (Manager: ${mgr})` : ""}`
        : `Assigned to ${exec}`,
    };
  }

  if (args.activityHintsNoCapacity || execMissing) {
    return { kind: "error", message: NO_RENOVATION_CAPACITY_TOAST };
  }

  return { kind: "error", message: NO_RENOVATION_CAPACITY_TOAST };
}
