import type { QuickAccessParentItem } from "./QuickAccessSidebar";

export const dashboardSidebarSections: QuickAccessParentItem[] = [
  {
    id: "crm",
    label: "CRM",
    subtitle: "Quick Access",
    icon: "👥",
    items: [
      { id: "crm-overview", label: "Pipeline", description: "Track open opportunities", icon: "📈" },
      { id: "crm-inbox", label: "Inbox", description: "Follow up with prospects", icon: "✉️" },
      { id: "crm-schedule", label: "Schedule", description: "Plan calls and visits", icon: "🗓️" },
    ],
  },
  {
    id: "design",
    label: "Design",
    subtitle: "Quick Access",
    icon: "🎨",
    items: [
      { id: "design-moodboards", label: "Moodboards", description: "Save concept directions", icon: "🧩" },
      { id: "design-materials", label: "Materials", description: "Browse finish selections", icon: "🪵" },
      { id: "design-gallery", label: "Gallery", description: "Review visual drafts", icon: "🖼️" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    subtitle: "Quick Access",
    icon: "⚙️",
    items: [
      { id: "admin-panel", label: "Admin Panel", description: "Configuration & controls", icon: "🛠️" },
      { id: "admin-users", label: "Users & Roles", description: "Manage access", icon: "👤" },
      { id: "admin-integrations", label: "Integrations", description: "Connect apps", icon: "🔗" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    subtitle: "Quick Access",
    icon: "📊",
    items: [
      { id: "reports-daily", label: "Daily Summary", description: "Snapshot for today", icon: "🧾" },
      { id: "reports-weekly", label: "Weekly Review", description: "Monitor team outcomes", icon: "📌" },
      { id: "reports-export", label: "Export Hub", description: "Share report packs", icon: "📤" },
    ],
  },
  {
    id: "tasks",
    label: "Tasks",
    subtitle: "Quick Access",
    icon: "✅",
    badge: "5",
    items: [
      { id: "tasks-today", label: "Today", description: "Priority work queue", icon: "☀️" },
      { id: "tasks-team", label: "Team Tasks", description: "Delegate and monitor", icon: "🤝" },
      { id: "tasks-done", label: "Completed", description: "Recently finished items", icon: "🎉" },
    ],
  },
];

export const leadSidebarSections: QuickAccessParentItem[] = [
  {
    id: "lead-overview",
    label: "Lead",
    subtitle: "Quick Access",
    icon: "🧑",
    items: [
      { id: "lead-summary", label: "Lead Summary", description: "Core profile details", icon: "📇" },
      { id: "lead-notes", label: "Lead Notes", description: "Review discussion points", icon: "📝" },
      { id: "lead-docs", label: "Lead Docs", description: "Open attached records", icon: "📁" },
    ],
  },
  {
    id: "site-visit",
    label: "Visits",
    subtitle: "Quick Access",
    icon: "📍",
    items: [
      { id: "visit-plan", label: "Visit Plan", description: "Prepare next appointment", icon: "🗺️" },
      { id: "visit-history", label: "Visit History", description: "Past meetings timeline", icon: "🕒" },
      { id: "visit-feedback", label: "Feedback", description: "Capture visit outcomes", icon: "💬" },
    ],
  },
  {
    id: "proposal",
    label: "Proposal",
    subtitle: "Quick Access",
    icon: "📦",
    items: [
      { id: "proposal-draft", label: "Draft Deck", description: "Static proposal preview", icon: "🧠" },
      { id: "proposal-pricing", label: "Pricing", description: "Budget breakdown", icon: "💵" },
      { id: "proposal-approval", label: "Approval", description: "Internal review status", icon: "✅" },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    subtitle: "Quick Access",
    icon: "📡",
    items: [
      { id: "activity-feed", label: "Activity Feed", description: "Recent updates", icon: "📟" },
      { id: "activity-tasks", label: "Task Links", description: "Connected follow-ups", icon: "🔔" },
      { id: "activity-team", label: "Team Notes", description: "Internal collaboration", icon: "👥" },
    ],
  },
];
