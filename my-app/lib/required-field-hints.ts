/** Warm, clear copy for mandatory CRM fields — tooltips and validation share this. */
export const REQUIRED_FIELD_HINTS = {
  budget:
    "Please fill in Budget Range. Without it, we can’t move this lead into Connection yet.",
  configuration:
    "Please select Configuration (BHK). We need this before the next phase can open.",
  bookingType:
    "Please choose Type. This small step unlocks booking and meeting flows.",
  propertyNotes:
    "Please add Property Notes. A few lines help the team, and we need them to advance.",
  floorPlan:
    "Please upload a Floor Plan. Meetings and Configuration Scope rely on it.",
  propertyName:
    "Please enter Property Name / Site. It keeps everyone clear on the home we’re designing.",
  bhkType:
    "Please select BHK Type. It shapes the scope and what we schedule next.",
  scopeBookingType:
    "Please select Type. Without it, we can’t finalize scope or schedule a meeting.",
  expectedTimeline:
    "Please pick a Timeline Expectation. It helps us plan the journey with care.",
  roomUnits:
    "Please select at least 2 units for this room so the designer has a clear picture.",
  roomNotes:
    "Please add Specific Room Notes. Your words gently guide what gets designed here.",
  roomsExtra:
    "Please add at least one more room beside Modular Kitchen before we can continue.",
  rooms:
    "Please add at least one room in Requirement Scope so we know what to design.",
} as const;
