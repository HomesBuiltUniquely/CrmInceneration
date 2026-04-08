"use client";

import Image from "next/image";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import AdminPanelContent from "./AdminPanelContent";

export default function AdminPanelClient() {
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
            profileName="admin"
            profileRole="SUPER_ADMIN"
            profileInitials="AD"
          />
        </div>

        <div className="bg-white xl:h-screen xl:overflow-y-auto">
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
                    Admin Panel
                  </div>
                  <div className="text-sm text-black">
                    Configuration & controls — Super Admin view
                  </div>
                </div>
              </div>
            </div>
          </div>

          <AdminPanelContent />
        </div>
      </div>
    </div>
  );
}
