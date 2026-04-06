import Header from "../Components/CrmDashboard/Header";
import RequireAuth from "../Components/RequireAuth";

export default function AdminDashboard() {
  return (
    <RequireAuth>
      <main>
        <div className="xl:bg-gray-100">
          <Header role="super_admin" />
        </div>
      </main>
    </RequireAuth>
  );
}
