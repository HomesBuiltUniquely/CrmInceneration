import Image from "next/image";
import LogoutButton from "../LogoutButton";
import AnalyticsBar from "./AnalyticsBar";
import LeadFilters from "./LeadFilters";
import CrmPipeline from "./CrmPipeline";
import InsightsStrip from "./InsightsStrip";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";

type Props = {
  role?: "sales_admin" | "sales_manager" | "super_admin";
};

export default function Header({ role = "sales_admin" }: Props) {
  return (
    <div className="min-h-screen bg-[#f7f9fc] xl:h-screen xl:overflow-hidden">
      <div className="grid min-h-screen xl:h-screen xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="hidden xl:block">
          <QuickAccessSidebar
            appBadge="HO WS"
            appName="Hows"
            appTagline="by HUB"
            sections={dashboardSidebarSections}
            profileName="admin"
            profileRole="SUPER_ADMIN"
            profileInitials="AD"
          />
        </div>
        <div className="bg-white xl:h-screen xl:overflow-y-auto">
          <div className="xl:flex xl:h-16 xl:w-full xl:justify-between xl:px-4 xl:shadow-md">
            <div className="xl:flex xl:items-center xl:pt-2">
              <div>
                <Image
                  src="/HowsCrmLogo.png"
                  alt="Description"
                  width={50}
                  height={50}
                />
              </div>
              <h1 className="xl:font-bold xl:pl-3 text-black">
                Lead Journey
                <span className="xl:text-blue-400 xl:font-bold xl:pl-4">
                  Simplified
                </span>
              </h1>
            </div>
            <div className="xl:flex xl:items-center">
              <div className="xl:mr-4 xl:w-25 xl:h-7.5 xl:bg-gray-200 xl:text-gray-500 xl:font-bold xl:rounded-lg xl:pl-4.5 xl:pt-1">
                Q3 FY24
              </div>
              <h1 className="xl:font-bold xl:pr-2 xl:text-black">
                Global Sales
              </h1>
              <LogoutButton className="border border-gray-300 bg-white px-3 py-1.5 text-gray-800 hover:bg-gray-50" />
              <div className="w-10 h-10 xl:rounded-full bg-gray-200"></div>
            </div>
          </div>
          <div>
            <LeadFilters role={role} />
            <AnalyticsBar />
            <CrmPipeline />
            <InsightsStrip />
          </div>
        </div>
      </div>
    </div>
  );
}
