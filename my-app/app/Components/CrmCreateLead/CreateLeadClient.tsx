"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import type { Lead } from "@/lib/data";
import CompleteTaskModal from "../CrmLeadDetails/CompleteTaskModal";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import { Button, Input, Select, Textarea } from "../CrmLeadDetails/ui";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";

const API_BASE = process.env.NEXT_PUBLIC_CRM_API_BASE ?? "http://localhost:8081";

const LEAD_SOURCES = [
  "Website",
  "Referral",
  "Social Media",
  "Walk-in",
  "Call",
  "Email",
  "Advertisement",
];

const LANGUAGE_OPTIONS = [
  "English",
  "Hindi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Marathi",
];

const FEEDBACK_OPTIONS = [
  { stage: "Initial Stage", substage: "Fresh Leads" },
  { stage: "Initial Stage", substage: "NAT" },
  { stage: "Active", substage: "RNR" },
  { stage: "Active", substage: "Call Back" },
  { stage: "Active", substage: "Asked to call back" },
  { stage: "Active", substage: "Requirement Received" },
  { stage: "Follow Up", substage: "Fix Appointment" },
  { stage: "Follow Up", substage: "Meeting Scheduled" },
  { stage: "Follow Up", substage: "Meeting Rescheduled" },
  { stage: "Follow Up", substage: "Meeting Cancelled" },
  { stage: "Follow Up", substage: "Schedule ONLINE meeting" },
  { stage: "Follow Up", substage: "Schedule OFFLINE meeting" },
  { stage: "Follow Up", substage: "Budget issues" },
  { stage: "OPPORTUNITY", substage: "Meeting done" },
  { stage: "OPPORTUNITY", substage: "Quote sent" },
  { stage: "OPPORTUNITY", substage: "MD but Quote pending" },
  { stage: "OPPORTUNITY", substage: "Schedule Re-visit" },
  { stage: "Booking", substage: "Prebooking" },
  { stage: "Booking", substage: "Booking 10%" },
  { stage: "In-Active", substage: "Unable to contact" },
  { stage: "In-Active", substage: "Possn Delayed" },
  { stage: "In-Active", substage: "No Property yet" },
  { stage: "In-Active", substage: "No Immediate Requirement" },
  { stage: "In-Active", substage: "On-Hold" },
  { stage: "Invalid", substage: "Wrong number" },
  { stage: "Invalid", substage: "Duplicate" },
  { stage: "Invalid", substage: "Fake Lead" },
  { stage: "Invalid", substage: "Dead Lead" },
  { stage: "Invalid", substage: "Switched OFF/ blocked" },
  { stage: "Invalid", substage: "Non servicable area" },
  { stage: "Invalid", substage: "Less Budget" },
  { stage: "Invalid", substage: "Not Interested" },
  { stage: "Invalid", substage: "Finalized with Compittior" },
  { stage: "Invalid", substage: "Already Done" },
  { stage: "Invalid", substage: "DND" },
  { stage: "WON", substage: "WON" },
  { stage: "LOST", substage: "LOST" },
];

type CreateLeadFormState = {
  name: string;
  email: string;
  propertyPincode: string;
  phoneNumber: string;
  altPhoneNumber: string;
  budget: string;
  leadSource: string;
  languagePrefered: string;
  propertyDetails: string;
  designerName: string;
  notes: string;
  followUpDate: string;
  quoteLink: string;
  feedbackSubstage: string;
  reason: string;
};

const INITIAL_FORM: CreateLeadFormState = {
  name: "",
  email: "",
  propertyPincode: "",
  phoneNumber: "",
  altPhoneNumber: "",
  budget: "",
  leadSource: "",
  languagePrefered: "",
  propertyDetails: "",
  designerName: "",
  notes: "",
  followUpDate: "",
  quoteLink: "",
  feedbackSubstage: "",
  reason: "",
};

function CreateLeadSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-6 py-7 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:px-7">
      <h2 className="text-[2rem] font-bold tracking-[-0.04em] text-slate-800">
        {title}
      </h2>
      <div className="mt-4 h-px bg-[#3794ff]" />
      <div className="mt-5">{children}</div>
    </section>
  );
}

function FormGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-2xl border-2 border-[#5b7fff] bg-slate-50/40 px-7 py-8",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

function SelectField(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    children: ReactNode;
  },
) {
  const { children, className, ...rest } = props;

  return (
    <div className="relative">
      <Select
        className={[
          "h-10 rounded-md border-slate-300 bg-white pr-11",
          "bg-none",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {children}
      </Select>
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}

function CreateLeadFieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-2 block text-[1.08rem] font-semibold tracking-[-0.01em] text-slate-700">
      {children}
      {required ? <span className="ml-1 text-amber-500">*</span> : null}
    </label>
  );
}

export default function CreateLeadClient() {
  const [role, setRole] = useState("SUPER_ADMIN");
  useEffect(() => {
    const stored = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "SUPER_ADMIN";
    setRole(normalizeRole(stored) || "SUPER_ADMIN");
  }, []);
  const [form, setForm] = useState<CreateLeadFormState>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [completeTaskOpen, setCompleteTaskOpen] = useState(false);
  const [createdLeadInfo, setCreatedLeadInfo] = useState<{
    id?: string | number;
    customerId?: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedFeedback = FEEDBACK_OPTIONS.find(
    (option) => option.substage === form.feedbackSubstage,
  );
  const isLost = form.feedbackSubstage.toUpperCase() === "LOST";
  const modalLead: Lead = {
    id: "create-lead-draft",
    name: form.name || "New Lead",
    customerId: "DRAFT-LEAD",
    status: form.feedbackSubstage || "Fresh Lead",
    createdAt: "Today",
    assignee: "Unassigned",
    designerName: form.designerName || "Not assigned",
    email: form.email,
    phone: form.phoneNumber,
    altPhone: form.altPhoneNumber,
    pincode: form.propertyPincode,
    configuration: "",
    floorPlan: "",
    possessionDate: "",
    propertyLocation: "",
    budget: form.budget,
    language: form.languagePrefered,
    leadSource: form.leadSource,
    meetingType: "",
    propertyNotes: form.propertyDetails,
    requirements: [],
    meetingDate: "",
    meetingVenue: "",
    followUpDate: form.followUpDate || "06 Apr 2026",
    agentName: "CRM User",
    activities: [],
  };

  function updateField<K extends keyof CreateLeadFormState>(
    key: K,
    value: CreateLeadFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.name.trim() || !form.phoneNumber.trim()) {
      setError("Name and phone are required.");
      return;
    }

    if (isLost && !form.reason.trim()) {
      setError("Reason is required when feedback is LOST.");
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim() || undefined,
      email: form.email.trim() || undefined,
      phoneNumber: form.phoneNumber.trim() || undefined,
      phone: form.phoneNumber.trim() || undefined,
      altPhoneNumber: form.altPhoneNumber.trim() || undefined,
      budget: form.budget.trim() || undefined,
      leadSource: form.leadSource || undefined,
      languagePrefered: form.languagePrefered || undefined,
      propertyPincode: form.propertyPincode.trim() || undefined,
      propertyPin: form.propertyPincode.trim() || undefined,
      pinCode: form.propertyPincode.trim() || undefined,
      designerName: form.designerName.trim() || undefined,
      propertyDetails: form.propertyDetails.trim() || undefined,
      quoteLink: form.quoteLink.trim() || undefined,
      followUpDate: form.followUpDate || undefined,
      notes: form.notes.trim() || undefined,
    };

    if (selectedFeedback) {
      payload.stage = {
        stage: selectedFeedback.stage,
        substage: {
          substage: selectedFeedback.substage,
        },
      };
    }

    if (isLost) {
      payload.reason = form.reason.trim();
      payload.resone = form.reason.trim();
    }

    startTransition(async () => {
      try {
        const authToken =
          typeof window !== "undefined"
            ? window.localStorage.getItem("authToken")
            : null;

        const response = await fetch(`${API_BASE}/v1/AddLead`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            typeof result?.error === "string"
              ? result.error
              : `Create lead failed with status ${response.status}`,
          );
        }

        setSuccess(
          typeof result?.message === "string"
            ? result.message
            : "Lead created successfully.",
        );
        setCreatedLeadInfo({
          id: result?.id,
          customerId: result?.customerId,
        });
        setForm(INITIAL_FORM);
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Unable to create lead.",
        );
      }
    });
  }

  return (
    <div
      className="min-h-screen bg-[#f7f9fc] xl:h-screen xl:overflow-hidden"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div className="grid min-h-screen xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <div className="hidden xl:block">
          <QuickAccessSidebar
            appBadge="HO WS"
            appName="Hows"
            appTagline="by HUB"
            sections={dashboardSidebarSections}
            profileName={role.replace(/_/g, " ")}
            profileRole={role}
            profileInitials="AD"
          />
        </div>

        <div className="bg-[#f7f9fc] xl:h-screen xl:overflow-y-auto">
          <div className="border-b border-slate-200 bg-white shadow-sm">
            <div className="flex min-h-16 items-center justify-between px-4 md:px-6">
              <div className="flex items-center gap-3">
                <Image
                  src="/HowsCrmLogo.png"
                  alt="Hows CRM"
                  width={46}
                  height={46}
                />
                <div>
                  <div className="text-[1.6rem] font-extrabold tracking-[-0.04em] text-slate-900">
                    Create Lead
                  </div>
                  <div className="text-sm text-slate-500">
                    New frontend form integrated with the original CRM create API
                  </div>
                </div>
              </div>
            </div>
          </div>

          <main className="px-4 py-6 md:px-6 lg:px-8">
            <div className="mx-auto max-w-[1460px] space-y-6">
              <div className="overflow-hidden rounded-[2px] bg-gradient-to-r from-[#6278ea] via-[#6b6fe0] to-[#7c44b6] shadow-[0_14px_34px_rgba(92,100,220,0.22)]">
                <div className="flex min-h-[96px] items-center gap-4 px-8 py-5">
                  <span className="text-[2.2rem] leading-none">📋</span>
                  <h1 className="text-[2.1rem] font-bold tracking-[-0.04em] text-white">
                    Lead Details
                  </h1>
                  <span className="inline-flex items-center rounded-full bg-[#fff1c9] px-5 py-2 text-sm font-bold text-[#ff8d00]">
                    Add Lead
                  </span>
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  <div>{success}</div>
                  {createdLeadInfo?.id || createdLeadInfo?.customerId ? (
                    <div className="mt-1 text-xs text-emerald-800">
                      {createdLeadInfo?.id ? `Lead ID: ${createdLeadInfo.id}` : ""}
                      {createdLeadInfo?.id && createdLeadInfo?.customerId ? " | " : ""}
                      {createdLeadInfo?.customerId
                        ? `Customer ID: ${createdLeadInfo.customerId}`
                        : ""}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-6">
                <CreateLeadSection title="Lead Information">
                  <div className="space-y-6">
                    <FormGroup>
                      <div className="grid gap-5 xl:grid-cols-4">
                        <div>
                          <CreateLeadFieldLabel required>Name</CreateLeadFieldLabel>
                          <Input
                            value={form.name}
                            onChange={(e) => updateField("name", e.target.value)}
                            className="h-10 rounded-md border-slate-300 bg-white"
                          />
                        </div>
                        <div>
                          <CreateLeadFieldLabel>Email</CreateLeadFieldLabel>
                          <Input
                            type="email"
                            value={form.email}
                            onChange={(e) => updateField("email", e.target.value)}
                            className="h-10 rounded-md border-slate-300 bg-white"
                          />
                        </div>
                        <div>
                          <CreateLeadFieldLabel>Property Pincode</CreateLeadFieldLabel>
                          <Input
                            value={form.propertyPincode}
                            onChange={(e) =>
                              updateField("propertyPincode", e.target.value)
                            }
                            className="h-10 rounded-md border-slate-300 bg-white"
                          />
                        </div>
                        <div>
                          <CreateLeadFieldLabel required>Phone</CreateLeadFieldLabel>
                          <Input
                            value={form.phoneNumber}
                            onChange={(e) =>
                              updateField("phoneNumber", e.target.value)
                            }
                            className="h-10 rounded-md border-slate-300 bg-white"
                          />
                        </div>
                      </div>
                    </FormGroup>

                    <FormGroup>
                      <div className="grid gap-5 xl:grid-cols-5">
                        <div>
                          <CreateLeadFieldLabel>Alternate Phone</CreateLeadFieldLabel>
                          <Input
                            value={form.altPhoneNumber}
                            onChange={(e) =>
                              updateField("altPhoneNumber", e.target.value)
                            }
                            className="h-10 rounded-md border-slate-300 bg-white"
                          />
                        </div>
                        <div>
                          <CreateLeadFieldLabel>Feedback</CreateLeadFieldLabel>
                          <SelectField
                            value={form.feedbackSubstage}
                            onChange={(e) =>
                              updateField("feedbackSubstage", e.target.value)
                            }
                          >
                            <option value="">Select Feedback</option>
                            {FEEDBACK_OPTIONS.map((option) => (
                              <option
                                key={`${option.stage}-${option.substage}`}
                                value={option.substage}
                              >
                                {option.substage}
                              </option>
                            ))}
                          </SelectField>
                        </div>
                        <div>
                          <CreateLeadFieldLabel>Budget</CreateLeadFieldLabel>
                          <Input
                            value={form.budget}
                            onChange={(e) => updateField("budget", e.target.value)}
                            className="h-10 rounded-md border-slate-300 bg-white"
                          />
                        </div>
                        <div>
                          <CreateLeadFieldLabel>Lead Source</CreateLeadFieldLabel>
                          <SelectField
                            value={form.leadSource}
                            onChange={(e) => updateField("leadSource", e.target.value)}
                          >
                            <option value="">Select Source</option>
                            {LEAD_SOURCES.map((source) => (
                              <option key={source} value={source}>
                                {source}
                              </option>
                            ))}
                          </SelectField>
                        </div>
                        <div>
                          <CreateLeadFieldLabel>Language Preferred</CreateLeadFieldLabel>
                          <SelectField
                            value={form.languagePrefered}
                            onChange={(e) =>
                              updateField("languagePrefered", e.target.value)
                            }
                          >
                            <option value="">Select Language</option>
                            {LANGUAGE_OPTIONS.map((language) => (
                              <option key={language} value={language}>
                                {language}
                              </option>
                            ))}
                          </SelectField>
                        </div>
                        <div className="xl:col-span-5">
                          <CreateLeadFieldLabel>Property Details</CreateLeadFieldLabel>
                          <Textarea
                            value={form.propertyDetails}
                            onChange={(e) =>
                              updateField("propertyDetails", e.target.value)
                            }
                            className="min-h-[100px] rounded-md border-slate-300 bg-white"
                          />
                        </div>
                      </div>
                    </FormGroup>

                    <FormGroup>
                      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                        <div>
                          <CreateLeadFieldLabel>Designer Name</CreateLeadFieldLabel>
                          <Input
                            value={form.designerName}
                            onChange={(e) =>
                              updateField("designerName", e.target.value)
                            }
                            className="h-10 rounded-md border-slate-300 bg-white"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCompleteTaskOpen(true)}
                          className="h-12 rounded-xl border border-[#8e49b6] bg-gradient-to-r from-[#b56ad9] to-[#9149c8] px-7 text-[0.98rem] font-bold tracking-[0.01em] text-white shadow-[0_12px_24px_rgba(145,73,200,0.28)] hover:-translate-y-px hover:from-[#a95ed0] hover:to-[#853dbc]"
                        >
                          <span className="text-base">📝</span>
                          COMPLETE TASK
                        </Button>
                      </div>
                    </FormGroup>
                  </div>
                </CreateLeadSection>

                <CreateLeadSection title="Notes">
                  <div>
                    <CreateLeadFieldLabel>Notes</CreateLeadFieldLabel>
                    <Textarea
                      value={form.notes}
                      onChange={(e) => updateField("notes", e.target.value)}
                      placeholder="Add any initial notes about this lead (optional)..."
                      className="min-h-[96px] rounded-md border-slate-300 bg-white font-mono"
                    />
                  </div>
                </CreateLeadSection>

                <CreateLeadSection title="Important Dates">
                  <div className="space-y-4">
                    <div>
                      <CreateLeadFieldLabel>Follow-up Date & Time</CreateLeadFieldLabel>
                      <Input
                        type="datetime-local"
                        value={form.followUpDate}
                        onChange={(e) => updateField("followUpDate", e.target.value)}
                        className="h-11 rounded-md border-slate-300 bg-white"
                      />
                    </div>
                    {isLost ? (
                      <div>
                        <CreateLeadFieldLabel required>Lost Reason</CreateLeadFieldLabel>
                        <Textarea
                          value={form.reason}
                          onChange={(e) => updateField("reason", e.target.value)}
                          placeholder="Enter reason for LOST"
                          className="min-h-[90px] rounded-md border-slate-300 bg-white"
                        />
                      </div>
                    ) : null}
                  </div>
                </CreateLeadSection>

                <div className="flex flex-wrap items-center justify-center gap-7 pb-6">
                  <Button
                    type="submit"
                    variant="success"
                    icon={isPending ? "…" : "💾"}
                    disabled={isPending}
                    className="min-w-[238px] justify-center rounded-md px-8 py-3 text-[1.05rem] font-bold text-white shadow-none"
                  >
                    {isPending ? "Creating..." : "Create Add Lead"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => window.print()}
                    className="min-w-[156px] justify-center rounded-xl border border-slate-700 bg-gradient-to-r from-slate-600 to-slate-700 px-8 py-3 text-[1.02rem] font-bold tracking-[0.01em] text-white shadow-[0_12px_24px_rgba(51,65,85,0.24)] hover:-translate-y-px hover:from-slate-700 hover:to-slate-800"
                  >
                    <span className="text-base">🖨</span>
                    Print
                  </Button>
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>
      <CompleteTaskModal
        lead={modalLead}
        open={completeTaskOpen}
        onClose={() => setCompleteTaskOpen(false)}
        onSave={(nextStatus) => {
          updateField("feedbackSubstage", nextStatus);
          setCompleteTaskOpen(false);
        }}
      />
    </div>
  );
}
