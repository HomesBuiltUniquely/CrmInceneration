import Header from "./Components/CrmDashboard/Header";
import RequireAuth from "./Components/RequireAuth";

export default function Home() {
  return (
    <RequireAuth>
      <main>
        <div className="xl:bg-gray-100">
          <Header />
        </div>
      </main>
    </RequireAuth>
  );
}
