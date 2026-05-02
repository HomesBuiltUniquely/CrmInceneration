import type { QuickAccessParentItem } from "./QuickAccessSidebar";

export const dashboardSidebarSections: QuickAccessParentItem[] = [
  {
    id: "crm",
    label: "CRM",
    subtitle: "Quick Access",
    icon: "users",
    items: [
      { id: "crm-my-leads", label: "My Leads", description: "View and manage pipeline", icon: "chart", href: "/Leads" },
      { id: "crm-create-lead", label: "Create Lead", description: "Add new lead manually", icon: "plus", href: "/create-lead" },
      { id: "crm-import-leads", label: "Import Leads", description: "Upload from Excel", icon: "upload", href: "/import-leads" },
      { id: "crm-hub-calendar", label: "Hub Calendar", description: "View and manage calendar events", icon: "calendar", href: "/google-calendar" },
      { id: "crm-sales-managers", label: "Sales Managers", description: "View managers list", icon: "id-card", href: "/admin-panel" },
      { id: "crm-presales-executives", label: "Presales Executives", description: "View presales executives", icon: "users", href: "/admin-panel" },
    ],
  },
  {
    id: "design",
    label: "Design",
    subtitle: "Quick Access",
    icon: "palette",
    items: [
      {
        id: "design-designer-dashboard",
        label: "Designer Dashboard",
        description: "My clients, queue & appointments",
        icon: "users",
        href: "/design-dashboard",
      },
      {
        id: "design-appointment",
        label: "Appointment",
        description: "Manage designer availability",
        icon: "calendar",
        href: "/appointment",
      },
      { id: "design-module", label: "Design Module", description: "Your design project", icon: "palette" },
      { id: "design-create-user", label: "Create Design User", description: "Add new designer/manager", icon: "plus", href: "/admin-panel" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    subtitle: "Quick Access",
    icon: "settings",
    items: [
      { id: "admin-panel", label: "Admin Panel", description: "Configuration & controls", icon: "wrench", href: "/admin-panel" },
    ],
  },
];

export const leadSidebarSections: QuickAccessParentItem[] = [
  {
    id: "lead-overview",
    label: "Lead",
    subtitle: "Quick Access",
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
    subtitle: "Quick Access",
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
    subtitle: "Quick Access",
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
    subtitle: "Quick Access",
    icon: "activity",
    items: [
      { id: "activity-feed", label: "Activity Feed", description: "Recent updates", icon: "activity" },
      { id: "activity-tasks", label: "Task Links", description: "Connected follow-ups", icon: "bell" },
      { id: "activity-team", label: "Team Notes", description: "Internal collaboration", icon: "users" },
    ],
  },
];
