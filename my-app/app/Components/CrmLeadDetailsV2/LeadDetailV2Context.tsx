"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Lead } from "@/lib/data";
import type { CrmLeadType } from "@/lib/leads-filter";

export type TimelineOption = {
  value: string;
  label: string;
  fullLabel?: string;
  leadType?: CrmLeadType;
  leadId?: string;
};

export type LeadDetailV2ContextValue = {
  leadType: string;
  leadId: string;
  lead: Lead;
  viewerRoleKey: string;
  presalesHandedOff: boolean;
  inSalesPhase: boolean;
  completeTaskDisabled: boolean;
  canShowGetQuote: boolean;
  canStageRollback: boolean;
  canClosedLeadHeader: boolean;
  showMarkAsWon: boolean;
  createdTimelineOptions: TimelineOption[];
  createdTimelineLoading: boolean;
  selectedTimelineValue: string;
  onCreatedTimelineChange: (value: string) => void;
  onGetQuote: () => void;
  quoteFetching: boolean;
  onOpenStageRollback: () => void;
  onCompleteTask: () => void;
  onMarkAsWon: () => void;
  onFloorPlanUpload: (file: File) => void | Promise<void>;
  onFloorPlanRemove?: () => void | Promise<void>;
  onFloorPlanMissing?: () => void;
  floorPlanUploading: boolean;
  floorPlanRemoving: boolean;
  quoteSending: boolean;
  quoteLinkPersisting: boolean;
  quoteLinkPersistError: string;
  onSendQuote: () => void | Promise<void>;
  onRetrySaveQuoteLink?: () => void | Promise<void>;
  onDesignQaLinkCopied?: (link: string) => void | Promise<void>;
  designQaLink: string;
  apiDesignQaLink: string;
  meetingDateDisplay: string;
  followUpDateDisplay: string;
  milestoneStageLabel: string;
  milestoneCategoryLabel: string;
  milestoneSubLabel: string;
  onLeadPatch: (patch: Partial<Lead>) => void;
  onConnectionPhaseSave: () => void | Promise<void>;
  connectionPhaseSaving: boolean;
  canEditLeadPhoneEmail: boolean;
  shouldMaskLeadPhone: boolean;
  onLeadContactSave: (patch: Partial<Lead>) => void | Promise<void>;
  leadContactSaving: boolean;
};

const LeadDetailV2Context = createContext<LeadDetailV2ContextValue | null>(null);

export function LeadDetailV2Provider({
  value,
  children,
}: {
  value: LeadDetailV2ContextValue;
  children: ReactNode;
}) {
  return <LeadDetailV2Context.Provider value={value}>{children}</LeadDetailV2Context.Provider>;
}

export function useLeadDetailV2(): LeadDetailV2ContextValue {
  const ctx = useContext(LeadDetailV2Context);
  if (!ctx) {
    throw new Error("useLeadDetailV2 must be used within LeadDetailV2Provider");
  }
  return ctx;
}

export function useOptionalLeadDetailV2(): LeadDetailV2ContextValue | null {
  return useContext(LeadDetailV2Context);
}
