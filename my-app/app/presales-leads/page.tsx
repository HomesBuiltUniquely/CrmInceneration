import RequireAuth from "../Components/RequireAuth";
import Header from "../Components/CrmLeadData/Header";

export default function PresalesLeadsPage() {
  return (
    <RequireAuth>
      <div>
        <Header />
      </div>
    </RequireAuth>
  );
}
