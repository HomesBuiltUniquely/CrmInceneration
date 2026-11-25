export function followUpModalTitle(
  variant: "morning" | "evening",
  firstName: string,
): string {
  const name = firstName.trim() || "there";
  if (variant === "evening") {
    return `Hi, ${name} — today's follow-up report`;
  }
  return `Hi, ${name} — today's follow-ups`;
}

export function firstNameFromDisplayName(displayName: string): string {
  const t = displayName.trim();
  if (!t) return "";
  return t.split(/\s+/)[0] ?? t;
}