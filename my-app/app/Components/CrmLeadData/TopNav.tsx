"use client";

import AppTopBar from "@/app/Components/Shared/AppTopBar";

/** My Leads top bar — search enabled on `/Leads` and `/presales-leads`. */
export default function TopNav({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
}) {
  return <AppTopBar search={search} onSearchChange={onSearchChange} />;
}
