import JourneyPhaseHeatmap from "./JourneyPhaseHeatmap";
import LeadsTable from "./LeadsTable";
import LeadsToolbar from "./LeadsToolbar";
import TopNav from "./TopNav";

export default function Header() {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <JourneyPhaseHeatmap />
      <LeadsToolbar />
      <LeadsTable />
      <div className="h-10"/></div>
  );
}