export type SummaryPeriod =
  | "today"
  | "last3Days"
  | "last7Days"
  | "last1Month"
  | "last3Months"
  | "all";

export type SummaryDuration =
  | "any"
  | "under1Min"
  | "twoToThreeMin"
  | "fiveToTenMin"
  | "tenToFifteenMin";

export type ContentTab = "calls" | "recordings" | "executives";

export type MetricTone =
  | "navy"
  | "teal"
  | "blue"
  | "red"
  | "amber"
  | "violet";

export type SummaryMetric = {
  id: string;
  label: string;
  count: number;
  talkTimeLabel: string;
  talkTimeSec: number;
  tone: MetricTone;
};

export type CallDirection =
  | "Incoming"
  | "Outgoing"
  | "Missed"
  | "Client rejected"
  | "Sales rejected";

export type ActivityListRow = {
  id: string;
  leadName: string;
  leadId: string;
  leadType: string;
  direction: CallDirection;
  executive: string;
  executiveUserId?: number;
  startedAt: string | null;
  startedAtLabel: string;
  durationSec: number;
  durationLabel: string;
  phoneMasked: string;
  hasRecording?: boolean;
  recordingId?: number;
};

export type SummaryHubFilters = {
  branch: string;
  salesAdmin: string;
  salesManager: string;
  salesExecutive: string;
  salesExecutiveUserId: number | null;
  presalesManager: string;
  presalesExecutive: string;
  assignee: string;
  reinquiry: string;
};

export type SummaryFiltersState = {
  period: SummaryPeriod;
  duration: SummaryDuration;
  leadTypeKey: string;
  sortKey: string;
  hub: SummaryHubFilters;
};

export type HubCallEvent = {
  eventId: number;
  userId: number;
  leadType: string;
  leadId: number;
  outcome: string;
  peerPhone: string;
  durationSec: number;
  startedAt: string | null;
  recordingId: number | null;
  hasRecording: boolean;
  leadDisplayName: string;
  leadDisplayId: string;
  executiveName: string;
};

export type HubCallRecording = {
  recordingId: number;
  leadType: string;
  leadId: number;
  userId: number;
  direction: string;
  peerPhone: string;
  status: string;
  errorCode: string;
  durationSec: number;
  startedAt: string | null;
  uploaded: boolean;
  leadDisplayName: string;
  leadDisplayId: string;
  executiveName: string;
};

export type CallSummaryTotals = {
  incoming: number;
  outgoing: number;
  missed: number;
  salesRejected: number;
  clientRejected: number;
  total: number;
  callSyncLastAt: string | null;
};

export type SyncHealthExecutive = {
  userId: number;
  executiveName: string;
  role: string;
  health: string;
  callSyncLastAt: string | null;
};

export type CallSyncHealth = {
  staleDays: number;
  teamCallSyncLastAt: string | null;
  executives: SyncHealthExecutive[];
};

export type FilterOption = {
  value: string;
  label: string;
  userId?: number;
  managerId?: number | null;
  managerName?: string;
};

export type RecordingCallLogsFilterOptions = {
  branches: FilterOption[];
  salesAdmins: FilterOption[];
  salesManagers: FilterOption[];
  salesExecutives: FilterOption[];
  presalesManagers: FilterOption[];
  presalesExecutives: FilterOption[];
  assignees: FilterOption[];
};

export const EMPTY_HUB_FILTERS: SummaryHubFilters = {
  branch: "",
  salesAdmin: "",
  salesManager: "",
  salesExecutive: "",
  salesExecutiveUserId: null,
  presalesManager: "",
  presalesExecutive: "",
  assignee: "",
  reinquiry: "",
};

export const DEFAULT_SUMMARY_FILTERS: SummaryFiltersState = {
  period: "today",
  duration: "any",
  leadTypeKey: "",
  sortKey: "updatedAt,desc",
  hub: EMPTY_HUB_FILTERS,
};
