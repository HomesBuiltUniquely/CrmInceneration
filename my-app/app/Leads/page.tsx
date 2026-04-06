import RequireAuth from "../Components/RequireAuth";
import Header from "../Components/CrmLeadData/Header";

export default function Lead() {
  return (
    <RequireAuth>
      <div>
        <Header />
      </div>
    </RequireAuth>
  );
}