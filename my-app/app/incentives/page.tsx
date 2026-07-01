import RequireAuth from "../Components/RequireAuth";
import IncentivesClient from "../Components/Incentives/IncentivesClient";

export const metadata = {
  title: "Incentives | Hows CRM",
  description: "Performance incentives and speed bonus tracking",
};

export default function IncentivesPage() {
  return (
    <RequireAuth>
      <IncentivesClient />
    </RequireAuth>
  );
}
