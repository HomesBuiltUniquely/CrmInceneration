export type MeetingStatus =
  | "SCHEDULED"
  | "IN PROGRESS"
  | "COMPLETED"
  | "RESCHEDULED"
  | "CANCELLED";

export type MeetingBucket = "today" | "upcoming" | "completed" | "cancelled";

export type MeetingIntent = "HIGH INTENT" | "WARM";

export type AvatarTone = "blue" | "green" | "violet" | "amber" | "rose";

export type LocationTone = "blue" | "green" | "violet";

export type MeetingRecord = {
  id: number;
  order: number;
  customer: string;
  initials: string;
  avatarTone: AvatarTone;
  intent: MeetingIntent;
  quoteNo: string;
  quoteCode: string;
  phone: string;
  assignee: string;
  assigneeRole: string;
  meetingType: string;
  whenLabel: string;
  whenNote: string;
  bucket: MeetingBucket;
  /** 0 = today, positive = future days, negative = past days. */
  dayOffset: number;
  location: string;
  locationTone: LocationTone;
  status: MeetingStatus;
  /** Whole rupees. Quotation total when a quote exists, otherwise the lead budget. */
  value: number;
  /** Lead budget in whole rupees. Stays the budget even after a quote exists. */
  budget: number;
  /** Lead quote in whole rupees. Zero when this lead has no quote yet. */
  quoteValue: number;
  valueSource?: "quotation" | "budget" | "";
  /** Calendar day the meeting sits on, `YYYY-MM-DD`. */
  date: string;
  /** Minutes from midnight. */
  startMin: number;
  durationMin?: number;
  appointmentId?: number;
  leadId?: number;
  /** Lead type label from the appointment, such as Add Lead. */
  leadType?: string;
  meetingTypeCode?: "SHOWROOM_VISIT" | "VIRTUAL_MEETING" | "SITE_VISIT";
  /** Appointment `meetingLabel` / `designMilestone`, shown as the meeting level. */
  meetingLevel?: string;
  meetingLabel?: string;
  customerEmail?: string;
  designerEmail?: string;
  /** CRM or Design module, from the appointment `source`. */
  appointmentSource?: string;
  /** Raw appointment source sent back on reschedule: CRM or DESIGN_MODULE. */
  sourceCode?: "CRM" | "DESIGN_MODULE";
  /** Lead type code sent back on reschedule, such as formlead. */
  leadTypeCode?: string;
  salesName?: string;
  salesEmail?: string;
  scheduledAt?: string;
  scheduledBy?: string;
  googleSyncStatus?: string;
  googleSyncMessage?: string;
  googleHtmlLink?: string;
  /** True when the lead's quote was sent to the customer. */
  quoteSent?: boolean;
  quoteSentAt?: string;
  milestoneStage?: string;
  milestoneSubStage?: string;
  /** Meeting time has passed and Experience & Design is still Meeting Scheduled. */
  needsOutcome?: boolean;
};

/** Start of the real local day. Offsets and “today” follow the clock, not a fixed sample date. */
export function startOfMeetingBoardToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function meetingIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function meetingOffset(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const start = startOfMeetingBoardToday();
  return Math.round((date.getTime() - start.getTime()) / 86400000);
}

export function formatMeetingWhen(offset: number, startMin: number): string {
  const hour = Math.floor(startMin / 60);
  const minute = startMin % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const time = `${String(h12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}`;
  if (offset === 0) return `Today, ${time}`;
  if (offset === 1) return `Tomorrow, ${time}`;
  const date = startOfMeetingBoardToday();
  date.setDate(date.getDate() + offset);
  const mon = date.toLocaleDateString("en-US", { month: "short" });
  return `${date.getDate()} ${mon} ${date.getFullYear()}, ${time}`;
}

export type MeetingActivity = {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: "blue" | "green";
  icon: "clock" | "check" | "plus" | "token";
};

/** Same meeting types the lead scheduler writes to the appointment API. */
export const MEETING_TYPES = ["Showroom Visit", "Virtual Meeting", "Site Visit"] as const;

export const MEETING_LOCATIONS = MEETING_TYPES;

const FEATURED_DRAFTS = [
  {
    id: 1,
    order: 1,
    customer: "Manish prakash",
    initials: "MP",
    avatarTone: "blue",
    intent: "HIGH INTENT",
    quoteNo: "75756",
    quoteCode: "AL-WKEKHUC0H8",
    phone: "9845012210",
    assignee: "Jayashree",
    assigneeRole: "Senior Architect",
    meetingType: "1st Discovery",
    whenLabel: "Today, 02:30 PM",
    whenNote: "In 45 minutes",
    bucket: "today",
    dayOffset: 0,
    location: "Showroom EC 1",
    locationTone: "blue",
    status: "SCHEDULED",
    value: 850063,
  },
  {
    id: 2,
    order: 2,
    customer: "Srivathsan",
    initials: "SR",
    avatarTone: "green",
    intent: "WARM",
    quoteNo: "75593",
    quoteCode: "AL-SIMNWYZEXB",
    phone: "9884021184",
    assignee: "Priti Dutta",
    assigneeRole: "3D Visualizer Lead",
    meetingType: "Design Presentation",
    whenLabel: "Today, 04:00 PM",
    whenNote: "Confirmed",
    bucket: "today",
    dayOffset: 0,
    location: "Google Meet",
    locationTone: "green",
    status: "IN PROGRESS",
    value: 932182,
  },
  {
    id: 3,
    order: 3,
    customer: "Jeevan",
    initials: "JE",
    avatarTone: "violet",
    intent: "HIGH INTENT",
    quoteNo: "75621",
    quoteCode: "Sobha City",
    phone: "9900188342",
    assignee: "Shaddisha Chari",
    assigneeRole: "Design Consultant",
    meetingType: "BOQ & Budget Lock",
    whenLabel: "Tomorrow, 11:30 AM",
    whenNote: "Client Rescheduled",
    bucket: "upcoming",
    dayOffset: 1,
    location: "Site Visit",
    locationTone: "violet",
    status: "RESCHEDULED",
    value: 432926,
  },
  {
    id: 4,
    order: 4,
    customer: "Ananya Rao",
    initials: "AR",
    avatarTone: "rose",
    intent: "HIGH INTENT",
    quoteNo: "75480",
    quoteCode: "WH-PRKVIEW04",
    phone: "9741200981",
    assignee: "Jayashree",
    assigneeRole: "Senior Architect",
    meetingType: "Design Presentation",
    whenLabel: "08 Oct, 03:15 PM",
    whenNote: "Deck signed off",
    bucket: "completed",
    dayOffset: -5,
    location: "Showroom EC 1",
    locationTone: "blue",
    status: "COMPLETED",
    value: 612400,
  },
  {
    id: 5,
    order: 5,
    customer: "Karthik Menon",
    initials: "KM",
    avatarTone: "amber",
    intent: "WARM",
    quoteNo: "75311",
    quoteCode: "EC-VILLA18",
    phone: "9812340091",
    assignee: "Meghana",
    assigneeRole: "Design Architect",
    meetingType: "Site Visit",
    whenLabel: "16 Oct, 10:00 AM",
    whenNote: "Floor plan walkthrough",
    bucket: "upcoming",
    dayOffset: 3,
    location: "Site Visit",
    locationTone: "violet",
    status: "SCHEDULED",
    value: 1575000,
  },
  {
    id: 6,
    order: 6,
    customer: "Divya Shetty",
    initials: "DS",
    avatarTone: "green",
    intent: "HIGH INTENT",
    quoteNo: "75240",
    quoteCode: "AL-KITCHEN09",
    phone: "9733302218",
    assignee: "Priti Dutta",
    assigneeRole: "3D Visualizer Lead",
    meetingType: "Material Board",
    whenLabel: "06 Oct, 01:00 PM",
    whenNote: "Samples approved",
    bucket: "completed",
    dayOffset: -7,
    location: "Showroom EC 2",
    locationTone: "blue",
    status: "COMPLETED",
    value: 488250,
  },
  {
    id: 7,
    order: 7,
    customer: "Rohit Verma",
    initials: "RV",
    avatarTone: "blue",
    intent: "WARM",
    quoteNo: "75188",
    quoteCode: "SKY-PENT02",
    phone: "9900012455",
    assignee: "Shaddisha Chari",
    assigneeRole: "Design Consultant",
    meetingType: "1st Discovery",
    whenLabel: "11 Oct, 05:30 PM",
    whenNote: "Client unavailable",
    bucket: "cancelled",
    dayOffset: -2,
    location: "Google Meet",
    locationTone: "green",
    status: "CANCELLED",
    value: 2100000,
  },
  {
    id: 8,
    order: 8,
    customer: "Priya Nair",
    initials: "PN",
    avatarTone: "violet",
    intent: "HIGH INTENT",
    quoteNo: "75701",
    quoteCode: "SKY-HIGHPH",
    phone: "9845099120",
    assignee: "Meghana",
    assigneeRole: "Design Architect",
    meetingType: "Design Presentation",
    whenLabel: "Today, 06:15 PM",
    whenNote: "Confirmation pending",
    bucket: "today",
    dayOffset: 0,
    location: "Showroom EC 1",
    locationTone: "blue",
    status: "SCHEDULED",
    value: 1844200,
  },
  {
    id: 9,
    order: 9,
    customer: "Gautham",
    initials: "GA",
    avatarTone: "amber",
    intent: "HIGH INTENT",
    quoteNo: "74990",
    quoteCode: "EC-TOKEN10",
    phone: "9886004412",
    assignee: "Jayashree",
    assigneeRole: "Senior Architect",
    meetingType: "Material Board",
    whenLabel: "04 Oct, 12:30 PM",
    whenNote: "Token handed off",
    bucket: "completed",
    dayOffset: -9,
    location: "Showroom EC 1",
    locationTone: "blue",
    status: "COMPLETED",
    value: 325000,
  },
  {
    id: 10,
    order: 10,
    customer: "Rajasekar JB",
    initials: "RJ",
    avatarTone: "blue",
    intent: "HIGH INTENT",
    quoteNo: "75109",
    quoteCode: "GL-ZWKBYTJB65",
    phone: "9741552088",
    assignee: "Meghana",
    assigneeRole: "Design Architect",
    meetingType: "BOQ & Budget Lock",
    whenLabel: "14 Oct, 05:00 PM",
    whenNote: "Contract Finalization",
    bucket: "upcoming",
    dayOffset: 1,
    location: "Showroom EC 1",
    locationTone: "blue",
    status: "SCHEDULED",
    value: 1351957,
  },
  {
    id: 11,
    order: 11,
    customer: "Asha",
    initials: "AS",
    avatarTone: "violet",
    intent: "HIGH INTENT",
    quoteNo: "76011",
    quoteCode: "SV-LAYOUT",
    phone: "9845001122",
    assignee: "Alice",
    assigneeRole: "Design Consultant",
    meetingType: "Site Visit",
    whenLabel: "Today, 10:00 AM",
    whenNote: "Token paid",
    bucket: "today",
    dayOffset: 0,
    location: "Site Visit",
    locationTone: "violet",
    status: "SCHEDULED",
    value: 400322,
  },
  {
    id: 12,
    order: 12,
    customer: "Mohammed",
    initials: "MO",
    avatarTone: "green",
    intent: "WARM",
    quoteNo: "75297",
    quoteCode: "GM-WALK01",
    phone: "9900112233",
    assignee: "Priti Dutta",
    assigneeRole: "3D Visualizer Lead",
    meetingType: "Design Presentation",
    whenLabel: "12 Oct, 11:00 AM",
    whenNote: "Quote 75297",
    bucket: "completed",
    dayOffset: -1,
    location: "Google Meet",
    locationTone: "green",
    status: "COMPLETED",
    value: 861412,
  },
  {
    id: 13,
    order: 13,
    customer: "Jameel",
    initials: "JA",
    avatarTone: "rose",
    intent: "WARM",
    quoteNo: "74820",
    quoteCode: "NS-MEET02",
    phone: "9811122233",
    assignee: "Meghana",
    assigneeRole: "Design Architect",
    meetingType: "1st Discovery",
    whenLabel: "12 Oct, 02:00 PM",
    whenNote: "Client No-Show",
    bucket: "cancelled",
    dayOffset: -1,
    location: "Google Meet",
    locationTone: "green",
    status: "CANCELLED",
    value: 3041068,
  },
  {
    id: 14,
    order: 14,
    customer: "Sb",
    initials: "SB",
    avatarTone: "green",
    intent: "HIGH INTENT",
    quoteNo: "74660",
    quoteCode: "VR-WALK03",
    phone: "9733344455",
    assignee: "Priti Dutta",
    assigneeRole: "3D Visualizer Lead",
    meetingType: "Design Presentation",
    whenLabel: "12 Oct, 03:00 PM",
    whenNote: "Virtual 3D Walkthrough",
    bucket: "completed",
    dayOffset: -1,
    location: "Google Meet",
    locationTone: "green",
    status: "COMPLETED",
    value: 540000,
  },
  {
    id: 15,
    order: 15,
    customer: "Gautham",
    initials: "GA",
    avatarTone: "amber",
    intent: "HIGH INTENT",
    quoteNo: "76140",
    quoteCode: "EC2-MAT01",
    phone: "9886004412",
    assignee: "Meghana",
    assigneeRole: "Design Architect",
    meetingType: "Material Board",
    whenLabel: "14 Oct, 02:00 PM",
    whenNote: "Material Selection",
    bucket: "upcoming",
    dayOffset: 1,
    location: "Showroom EC 2",
    locationTone: "blue",
    status: "SCHEDULED",
    value: 845584,
  },
];

const FEATURED_DATES: Record<number, { date: string; startMin: number; dayOffset: number }> = {
  1: { date: "2026-10-13", startMin: 14 * 60 + 30, dayOffset: 0 },
  2: { date: "2026-10-13", startMin: 16 * 60, dayOffset: 0 },
  3: { date: "2026-10-14", startMin: 11 * 60 + 30, dayOffset: 1 },
  4: { date: "2026-10-08", startMin: 15 * 60 + 15, dayOffset: -5 },
  5: { date: "2026-10-16", startMin: 10 * 60, dayOffset: 3 },
  6: { date: "2026-10-06", startMin: 13 * 60, dayOffset: -7 },
  7: { date: "2026-10-11", startMin: 17 * 60 + 30, dayOffset: -2 },
  8: { date: "2026-10-13", startMin: 18 * 60 + 15, dayOffset: 0 },
  9: { date: "2026-10-04", startMin: 12 * 60 + 30, dayOffset: -9 },
  10: { date: "2026-10-14", startMin: 17 * 60, dayOffset: 1 },
  11: { date: "2026-10-13", startMin: 10 * 60, dayOffset: 0 },
  12: { date: "2026-10-12", startMin: 11 * 60, dayOffset: -1 },
  13: { date: "2026-10-12", startMin: 14 * 60, dayOffset: -1 },
  14: { date: "2026-10-12", startMin: 15 * 60, dayOffset: -1 },
  15: { date: "2026-10-14", startMin: 14 * 60, dayOffset: 1 },
};

const FEATURED: MeetingRecord[] = FEATURED_DRAFTS.map((row) => {
  const meta = FEATURED_DATES[row.id];
  return {
    ...row,
    date: meta.date,
    startMin: meta.startMin,
    dayOffset: meta.dayOffset,
    whenLabel: meta.dayOffset < 0 ? formatMeetingWhen(meta.dayOffset, meta.startMin) : row.whenLabel,
    budget: row.value,
    quoteValue: 0,
  } as MeetingRecord;
});

const CUSTOMERS = [
  "Aisha Khan", "Vikram Iyer", "Neha Kapoor", "Sanjay Reddy", "Meera Joshi",
  "Arjun Patel", "Lakshmi Nair", "Farhan Ali", "Sneha Kulkarni", "Harish Babu",
  "Pooja Singh", "Naveen Rao", "Ishita Bose", "Rahul Desai", "Kavya Menon",
  "Aditya Shah", "Ritika Jain", "Suresh Kumar", "Anjali Gupta", "Deepak Nair",
];

const ASSIGNEES: Array<{ name: string; role: string }> = [
  { name: "Jayashree", role: "Senior Architect" },
  { name: "Priti Dutta", role: "3D Visualizer Lead" },
  { name: "Shaddisha Chari", role: "Design Consultant" },
  { name: "Meghana", role: "Design Architect" },
];

const NOTES: Record<MeetingBucket, string[]> = {
  today: ["In 2 hours", "Confirmed", "Client en route", "Showroom hold"],
  upcoming: ["Awaiting confirmation", "Brief shared", "Site access arranged", "Deck in review"],
  completed: ["Notes logged", "Quote revised", "Samples shared", "Next step booked"],
  cancelled: ["No show", "Client postponed", "Lead paused", "Slot released"],
};

const STATUS_FOR_BUCKET: Record<MeetingBucket, MeetingStatus> = {
  today: "SCHEDULED",
  upcoming: "SCHEDULED",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
};

const TONES: AvatarTone[] = ["blue", "green", "violet", "amber", "rose"];

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function locationTone(location: string): LocationTone {
  if (location === "Google Meet") return "green";
  if (location === "Site Visit") return "violet";
  return "blue";
}

function whenFor(bucket: MeetingBucket, index: number): { label: string; offset: number; date: string; startMin: number } {
  const stamp = (offset: number, startMin: number) => {
    const date = startOfMeetingBoardToday();
    date.setDate(date.getDate() + offset);
    return { label: formatMeetingWhen(offset, startMin), offset, date: meetingIso(date), startMin };
  };
  if (bucket === "today") {
    const slots = [9 * 60, 11 * 60, 12 * 60, 13 * 60, 15 * 60 + 30, 17 * 60, 19 * 60, 20 * 60];
    return stamp(0, slots[index % slots.length]);
  }
  if (bucket === "upcoming") {
    const offset = 2 + (index % 12);
    return stamp(offset, (10 + (index % 6)) * 60);
  }
  if (bucket === "cancelled") {
    const offset = -(2 + (index % 18));
    return stamp(offset, (10 + (index % 5)) * 60);
  }
  const offset = -(2 + (index % 42));
  return stamp(offset, (9 + (index % 8)) * 60);
}

function pushBucket(list: MeetingRecord[], bucket: MeetingBucket, count: number, startId: number) {
  for (let i = 0; i < count; i += 1) {
    const customer = CUSTOMERS[(startId + i) % CUSTOMERS.length];
    const assignee = ASSIGNEES[(startId + i) % ASSIGNEES.length];
    const meetingType = MEETING_TYPES[(startId + i) % MEETING_TYPES.length];
    const location = MEETING_LOCATIONS[(startId + i) % MEETING_LOCATIONS.length];
    const when = whenFor(bucket, i);
    const id = startId + i;
    list.push({
      id,
      order: id,
      customer: i % 7 === 0 ? `${customer} ${id}` : customer,
      initials: initialsOf(customer),
      avatarTone: TONES[i % TONES.length],
      intent: i % 3 === 0 ? "WARM" : "HIGH INTENT",
      quoteNo: String(74000 + id),
      quoteCode: `AL-${(100000 + id * 17).toString(36).toUpperCase()}`,
      phone: `98${String(10000000 + id * 97).slice(0, 8)}`,
      assignee: assignee.name,
      assigneeRole: assignee.role,
      meetingType,
      whenLabel: when.label,
      whenNote: NOTES[bucket][i % NOTES[bucket].length],
      bucket,
      dayOffset: when.offset,
      date: when.date,
      startMin: when.startMin,
      location,
      locationTone: locationTone(location),
      status: STATUS_FOR_BUCKET[bucket],
      value: 180000 + ((id * 13711) % 2200000),
      budget: 180000 + ((id * 13711) % 2200000),
      quoteValue: 0,
    });
  }
}

export function createMeetingSeed(): MeetingRecord[] {
  const featuredBuckets = { today: 0, upcoming: 0, completed: 0, cancelled: 0 };
  for (const row of FEATURED) featuredBuckets[row.bucket] += 1;
  const extra: MeetingRecord[] = [];
  let nextId = Math.max(...FEATURED.map((row) => row.id)) + 1;
  const plan: Array<[MeetingBucket, number]> = [
    ["today", 12 - featuredBuckets.today],
    ["upcoming", 24 - featuredBuckets.upcoming],
    ["completed", 142 - featuredBuckets.completed],
    ["cancelled", 18 - featuredBuckets.cancelled],
  ];
  for (const [bucket, count] of plan) {
    const before = extra.length;
    pushBucket(extra, bucket, count, nextId);
    nextId += extra.length - before;
  }
  return [...FEATURED, ...extra].sort((a, b) => a.order - b.order);
}

export function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

/** Appointment `meetingLabel`: CRM stores `quote_meeting`; Design stores labels like `first-cut`. */
export function meetingLevelLabel(raw: string, sourceCode?: string): string {
  const key = (raw.trim() || (sourceCode === "CRM" ? "quote_meeting" : "")).toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return "—";
  if (key === "quote_meeting") return "Quote meeting";
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatMeetingValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return formatInr(value);
}

export function meetingBoardStats(rows: MeetingRecord[]) {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const total = rows.length;
  const scheduled = rows.filter(
    (row) => row.status === "SCHEDULED" || row.status === "IN PROGRESS" || row.status === "RESCHEDULED",
  ).length;
  const today = rows.filter((row) => row.dayOffset === 0 && row.status !== "CANCELLED").length;
  const completedMonth = rows.filter(
    (row) => row.status === "COMPLETED" && row.date.startsWith(monthPrefix),
  ).length;
  const completed = rows.filter((row) => row.status === "COMPLETED").length;
  const cancelled = rows.filter((row) => row.status === "CANCELLED").length;
  const quoted = rows.filter((row) => row.quoteSent).length;
  const meetingsDone = rows.filter((row) => row.milestoneSubStage === "Meeting Successful").length;
  const stillScheduled = rows.filter((row) => row.needsOutcome).length;
  const pct = (count: number) => (total > 0 ? Math.round((count / total) * 1000) / 10 : 0);
  return {
    total,
    scheduled,
    today,
    completedMonth,
    completedPct: pct(completed),
    cancelled,
    cancelledPct: pct(cancelled),
    quotedPct: pct(quoted),
    quoteSent: quoted,
    meetingsDone,
    stillScheduled,
  };
}

export const INITIAL_ACTIVITIES: MeetingActivity[] = [
  {
    id: "a1",
    title: "Meeting Rescheduled — Manish Prakash",
    detail: "By Jayashree • Client requested delay from 2 PM to 4 PM for showroom visit.",
    time: "7 mins ago",
    tone: "blue",
    icon: "clock",
  },
  {
    id: "a2",
    title: "Design Presentation Completed — Srivathsan",
    detail: "Deal pushed to BOQ Lock • Positive reaction on kitchen render.",
    time: "6 hours ago",
    tone: "green",
    icon: "check",
  },
  {
    id: "a3",
    title: "New Walk-in Meeting Booked — Jeevan",
    detail: "Auto-assigned to Shaddisha Chari for Sobha City 3BHK consultation.",
    time: "8 Oct",
    tone: "blue",
    icon: "plus",
  },
  {
    id: "a4",
    title: "Token Advance Handed Off — Gautham",
    detail: "₹10,000 received in showroom • Next meeting set for Material Board.",
    time: "4 Oct",
    tone: "green",
    icon: "token",
  },
];

export const VELOCITY_BARS = [18, 26, 16, 22, 34, 14, 24, 58, 78, 62, 96, 84];

export const VELOCITY_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
