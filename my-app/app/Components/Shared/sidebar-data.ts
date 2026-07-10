import type { QuickAccessParentItem } from "./QuickAccessSidebar";

export const dashboardSidebarSections: QuickAccessParentItem[] = [
  {
    id: "crm",
    label: "CRM",
    subtitle: "Turn connections into lasting customers.",
    icon: "leads",
    items: [
      {
        id: "crm-dashboard",
        label: "Dashboard",
        description: "Sales pipeline analytics & journey",
        icon: "crm-dashboard-flaticon",
        href: "/",
      },
      { id: "crm-my-leads", label: "My Leads", description: "View and manage pipeline", icon: "crm-my-leads-flaticon", href: "/Leads" },
      { id: "crm-incentives", label: "Incentives", description: "Performance incentives & bonuses", icon: "crm-incentives-flaticon", href: "/incentives" },
      { id: "crm-create-lead", label: "Create Lead", description: "Add new lead manually", icon: "crm-create-lead-flaticon", href: "/create-lead" },
      { id: "crm-import-leads", label: "Import Leads", description: "Upload from Excel", icon: "crm-import-leads-flaticon", href: "/import-leads" },
      { id: "crm-hub-calendar", label: "Hub Calendar", description: "View and manage calendar events", icon: "crm-hub-calendar-flaticon", href: "/google-calendar" },
      { id: "crm-sales-managers", label: "Sales Managers", description: "View managers list", icon: "briefcase", href: "/admin-panel" },
      { id: "crm-presales-executives", label: "Presales Executives", description: "View presales executives", icon: "headset", href: "/admin-panel" },
      {
        id: "crm-booking-token",
        label: "Booking & Token",
        description: "Manage bookings & tokens",
        icon: "crm-booking-token-flaticon",
        href: "/booking-token",
      },
    ],
  },
  {
    id: "presales",
    label: "Presales",
    subtitle: "Every great deal starts here.",
    icon: "layout-dashboard",
    items: [
      {
        id: "presales-dashboard",
        label: "Dashboard",
        description: "Presales pipeline analytics & journey",
        icon: "presales-dashboard-flaticon",
        href: "/presales-dashboard",
      },
      { id: "presales-my-leads", label: "My Leads", description: "Presales team pipeline & month totals", icon: "crm-my-leads-flaticon", href: "/presales-leads" },
      { id: "presales-create-lead", label: "Create Lead", description: "Add new lead manually", icon: "crm-create-lead-flaticon", href: "/create-lead" },
    ],
  },
  {
    id: "design",
    label: "Design",
    subtitle: "Where ideas become experiences.",
    icon: "palette",
    items: [
      {
        id: "design-designer-dashboard",
        label: "Designer Dashboard",
        description: "My clients, queue & appointments",
        icon: "designer-dashboard-flaticon",
        href: "/design-dashboard",
      },
      {
        id: "design-appointment",
        label: "Appointment",
        description: "Manage designer availability",
        icon: "appointment-flaticon",
        href: "/appointment",
      },
      {
        id: "design-module",
        label: "Design Module",
        description: "Your design project",
        icon: "design-module-flaticon",
        href: "https://design.hubinterior.com",
      },
      { id: "design-create-user", label: "Create Design User", description: "Add new designer/manager", icon: "user-plus", href: "/admin-panel" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    subtitle: "Control everything with confidence.",
    icon: "settings",
    items: [
      { id: "admin-panel", label: "Admin Panel", description: "Configuration & controls", icon: "admin-panel-flaticon", href: "/admin-panel" },
    ],
  },
];

/** Sales dashboard & `/Leads` — hide presales module. */
export const salesWorkspaceSidebarSections: QuickAccessParentItem[] =
  dashboardSidebarSections.filter((s) => s.id !== "presales");

/** Presales dashboard & `/presales-leads` — presales module only. */
export const presalesWorkspaceSidebarSections: QuickAccessParentItem[] =
  dashboardSidebarSections.filter((s) => s.id === "presales");

export const leadSidebarSections: QuickAccessParentItem[] = [
  {
    id: "lead-overview",
    label: "Lead",
    subtitle: "Full picture",
    icon: "users",
    items: [
      { id: "lead-summary", label: "Lead Summary", description: "Core profile details", icon: "id-card" },
      { id: "lead-notes", label: "Lead Notes", description: "Review discussion points", icon: "note" },
      { id: "lead-docs", label: "Lead Docs", description: "Open attached records", icon: "folder" },
    ],
  },
  {
    id: "site-visit",
    label: "Visits",
    subtitle: "Visit to win",
    icon: "map-pin",
    items: [
      { id: "visit-plan", label: "Visit Plan", description: "Prepare next appointment", icon: "map-pin" },
      { id: "visit-history", label: "Visit History", description: "Past meetings timeline", icon: "clock" },
      { id: "visit-feedback", label: "Feedback", description: "Capture visit outcomes", icon: "message" },
    ],
  },
  {
    id: "proposal",
    label: "Proposal",
    subtitle: "Pitch perfect",
    icon: "box",
    items: [
      { id: "proposal-draft", label: "Draft Deck", description: "Static proposal preview", icon: "note" },
      { id: "proposal-pricing", label: "Pricing", description: "Budget breakdown", icon: "receipt" },
      { id: "proposal-approval", label: "Approval", description: "Internal review status", icon: "check-circle" },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    subtitle: "Stay sharp",
    icon: "activity",
    items: [
      { id: "activity-feed", label: "Activity Feed", description: "Recent updates", icon: "activity" },
      { id: "activity-tasks", label: "Task Links", description: "Connected follow-ups", icon: "bell" },
      { id: "activity-team", label: "Team Notes", description: "Internal collaboration", icon: "users" },
    ],
  },
];
