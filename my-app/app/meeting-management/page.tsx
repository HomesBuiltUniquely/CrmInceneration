"use client";

import MeetingManagementClient from "../Components/MeetingManagement/MeetingManagementClient";
import RequireAuth from "../Components/RequireAuth";

export default function MeetingManagementPage() {
  return (
    <RequireAuth>
      <MeetingManagementClient />
    </RequireAuth>
  );
}
