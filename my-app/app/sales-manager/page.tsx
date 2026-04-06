import Header from "../Components/CrmDashboard/Header";
import RequireAuth from "../Components/RequireAuth";

export default function SalesManagerDashboard() {
  return (
    <RequireAuth>
      <main>
        <div className="xl:bg-gray-100">
          <Header role="sales_manager" />
        </div>
      </main>
    </RequireAuth>
  );
}
