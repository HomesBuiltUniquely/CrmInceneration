"use client";

import RecordingCallLogsClient from "../Components/RecordingCallLogs/RecordingCallLogsClient";
import RequireAuth from "../Components/RequireAuth";

export default function RecordingCallLogsPage() {
  return (
    <RequireAuth>
      <RecordingCallLogsClient />
    </RequireAuth>
  );
}
