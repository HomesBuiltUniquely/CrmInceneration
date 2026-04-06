import JourneyPhaseHeatmap from "./JourneyPhaseHeatmap";
import LeadsDataSection from "./LeadsDataSection";
import TopNav from "./TopNav";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { leadSidebarSections } from "../Shared/sidebar-data";

export default function Header() {
  return (
    <div className="min-h-screen bg-slate-50 xl:h-screen xl:overflow-hidden">
      <div className="xl:grid xl:h-screen xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="hidden xl:block">
          <QuickAccessSidebar
            appBadge="LD"
            appName="Lead"
            appTagline="workspace"
            sections={leadSidebarSections}
            profileName="admin"
            profileRole="SUPER_ADMIN"
            profileInitials="AD"
          />
        </div>
        <div className="xl:h-screen xl:overflow-y-auto">
          <TopNav />
          <JourneyPhaseHeatmap />
          <LeadsToolbar />
          <LeadsTable />
          <div className="h-10" />
        </div>
      </div>
    </div>
  );
}
