import RequireAuth from "../Components/RequireAuth";
import DesignDashboardClient from "../Components/DesignDashboard/DesignDashboardClient";

export default function DesignDashboardPage() {
  return (
    <RequireAuth>
      <DesignDashboardClient />
    </RequireAuth>
  );
}
