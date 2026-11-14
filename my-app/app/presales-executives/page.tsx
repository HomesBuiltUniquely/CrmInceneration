import RequireAuth from "../Components/RequireAuth";
import PresalesExecutivesClient from "../Components/PresalesExecutives/PresalesExecutivesClient";

export default function PresalesExecutivesPage() {
  return (
    <RequireAuth>
      <PresalesExecutivesClient />
    </RequireAuth>
  );
}
