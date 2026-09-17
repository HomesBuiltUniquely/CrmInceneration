import { Suspense } from "react";
import RequireAuth from "../Components/RequireAuth";
import Header from "../Components/CrmLeadData/Header";

export default function Lead() {
  return (
    <RequireAuth>
      <div>
        <Suspense>
          <Header />
        </Suspense>
      </div>
    </RequireAuth>
  );
}