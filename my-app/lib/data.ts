import type { CrmLeadType } from "@/lib/leads-filter";

export type ActivityType = "assignment" | "note" | "update" | "status";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  timestamp: string;
  description: string;
  by: string;
  note?: string;
  change?: {
    old: string;
    new: string;
  };
}

export type LeadStageBlock = {
  milestoneStage?: string | null;
  milestoneStageCategory?: string | null;
  milestoneSubStage?: string | null;
  stage?: string | null;
  substage?: { substage?: string | null } | null;
};

export interface Lead {
  id: string;
  name: string;
  customerId: string;
  status: string;
  createdAt: string;
  assignee: string;
  designerName: string;
  /** Designer contact for notifications (design preference email — QA + meeting copy). */
  designerEmail?: string;
  email: string;
  phone: string;
  altPhone: string;
  pincode: string;
  configuration: string;
  floorPlan: string;
  possessionDate: string;
  propertyLocation: string;
  budget: string;
  language: string;
  leadSource: string;
  /** Raw `additionalLeadSources` string from API (for PUT round-trip). */
  additionalLeadSources?: string;
  /** Parsed extra sources for chips (see `parseAdditionalLeadSources`). */
  additionalLeadSourcesList?: string[];
  meetingType: string;
  propertyNotes: string;
  requirements: string[];
  meetingDate: string;
  meetingVenue: string;
  followUpDate: string;
  agentName: string;
  activities: ActivityItem[];
  /** Set when opened from `/v1/leads/filter` CRM list */
  leadType?: CrmLeadType;
  /** Pipeline + legacy stage for GET/PUT */
  stageBlock?: LeadStageBlock;
  /** Backend field `resone` — required when substage is LOST (legacy spelling). */
  lostReason?: string;
  /** Quote / proposal link for `POST /v1/quote/send`. */
  quoteLink?: string;
}

export const LANGUAGE_OPTIONS = [
  "English",
  "Hindi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Marathi",
];
export const LEAD_SOURCES = [
  "Website",
  "Referral",
  "Social Media",
  "Walk-in",
  "Call",
  "Email",
  "Advertisement",
  "Data",
  "Offline",
  "Pre-sales",
  "Emp - Referral",
  "CP Leads",
];
export const MEETING_TYPES = ["Site Visit", "Video Call", "Office Meeting", "Phone Call"];

export const leads: Lead[] = [
  {
    id: "jonathan-harker",
    name: "Jonathan Harker",
    customerId: "CRM-1048",
    status: "Requirement Received",
    createdAt: "26 Mar 2026",
    assignee: "Sarah Miller",
    designerName: "Nina Roy",
    email: "jonathan@transylvania-logistics.com",
    phone: "9876543210",
    altPhone: "9123456780",
    pincode: "560037",
    configuration: "3 BHK",
    floorPlan: "Type B",
    possessionDate: "May 2026",
    propertyLocation: "Whitefield, Bengaluru",
    budget: "45L",
    language: "English",
    leadSource: "Website",
    meetingType: "Site Visit",
    propertyNotes: "Prefers a modern interior language with practical storage in every room.",
    requirements: ["Living Room", "Modular Kitchen", "Wardrobes"],
    meetingDate: "02 Apr 2026",
    meetingVenue: "Project Site",
    followUpDate: "05 Apr 2026",
    agentName: "Priya Shah",
    activities: [
      {
        id: "jh-1",
        type: "assignment",
        timestamp: "Today, 10:20",
        description: "Lead assigned to Sarah Miller for first discovery call.",
        by: "CRM Admin",
      },
      {
        id: "jh-2",
        type: "note",
        timestamp: "Today, 11:05",
        description: "Client wants a quick moodboard before finalizing the next visit.",
        by: "Sarah Miller",
        note: "Focus on warm oak finishes, hidden storage, and low-maintenance surfaces.",
      },
      {
        id: "jh-3",
        type: "status",
        timestamp: "Today, 11:40",
        description: "Lead moved into active qualification.",
        by: "Sarah Miller",
        change: {
          old: "Initial Stage / Fresh Leads",
          new: "Requirement Received",
        },
      },
    ],
  },
  {
    id: "arthur-holcombe",
    name: "Arthur Holcombe",
    customerId: "CRM-1026",
    status: "Proposal Sent",
    createdAt: "23 Mar 2026",
    assignee: "David Chen",
    designerName: "Ritika S",
    email: "arthur@holcombe-industries.com",
    phone: "9988776655",
    altPhone: "9000011122",
    pincode: "560102",
    configuration: "4 BHK",
    floorPlan: "Penthouse",
    possessionDate: "June 2026",
    propertyLocation: "HSR Layout, Bengaluru",
    budget: "85L",
    language: "English",
    leadSource: "Referral",
    meetingType: "Office Meeting",
    propertyNotes: "Waiting on legal review before design lock. Timelines are tight.",
    requirements: ["Home Office", "Bar Unit", "Guest Bedroom"],
    meetingDate: "30 Mar 2026",
    meetingVenue: "HubInterior Studio",
    followUpDate: "01 Apr 2026",
    agentName: "Aditya Rao",
    activities: [
      {
        id: "ah-1",
        type: "update",
        timestamp: "Yesterday, 16:00",
        description: "Proposal revision shared with updated BOQ and payment schedule.",
        by: "David Chen",
      },
      {
        id: "ah-2",
        type: "note",
        timestamp: "Yesterday, 17:15",
        description: "Client highlighted concern about contract turnaround time.",
        by: "David Chen",
        note: "Legal review is now the main blocker. Escalation may be needed if delayed again.",
      },
      {
        id: "ah-3",
        type: "status",
        timestamp: "3 days ago",
        description: "Lead moved from site visit to proposal stage.",
        by: "David Chen",
        change: {
          old: "Site Visit Scheduled",
          new: "Proposal Sent",
        },
      },
    ],
  },
  {
    id: "elena-richardson",
    name: "Elena Richardson",
    customerId: "CRM-1061",
    status: "Site Visit Scheduled",
    createdAt: "28 Mar 2026",
    assignee: "Sarah Miller",
    designerName: "Megha Jain",
    email: "",
    phone: "9012345678",
    altPhone: "",
    pincode: "560066",
    configuration: "2.5 BHK",
    floorPlan: "Corner Unit",
    possessionDate: "April 2026",
    propertyLocation: "Sarjapur Road, Bengaluru",
    budget: "32L",
    language: "Hindi",
    leadSource: "Instagram",
    meetingType: "Video Call",
    propertyNotes: "Interested in a minimalist scheme with family-friendly materials.",
    requirements: ["Kids Room", "TV Unit", "Dining Storage"],
    meetingDate: "03 Apr 2026",
    meetingVenue: "Google Meet",
    followUpDate: "04 Apr 2026",
    agentName: "Neha Verma",
    activities: [
      {
        id: "er-1",
        type: "assignment",
        timestamp: "Today, 09:30",
        description: "Designer Megha Jain added for early concept prep.",
        by: "Sarah Miller",
      },
      {
        id: "er-2",
        type: "note",
        timestamp: "Today, 09:45",
        description: "Email still missing from the lead profile.",
        by: "Sarah Miller",
        note: "Capture email during the video call so proposal and summary can be shared properly.",
      },
    ],
  },
];

export function getLeadById(id: string) {
  return leads.find((lead) => lead.id === id);
}
