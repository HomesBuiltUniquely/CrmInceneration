import JourneyPhaseHeatmap from "./JourneyPhaseHeatmap";
import LeadsDataSection from "./LeadsDataSection";
import TopNav from "./TopNav";

export default function Header() {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <JourneyPhaseHeatmap />
      <LeadsDataSection />
      <div className="h-10" />
    </div>
  );
}