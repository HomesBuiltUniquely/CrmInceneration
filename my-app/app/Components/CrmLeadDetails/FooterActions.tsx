"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui";

export default function FooterActions({
  onSave,
  saving,
  onVerify,
  verifying,
}: {
  onSave?: () => void | Promise<void>;
  saving?: boolean;
  /** `POST .../verify/{id}` — Presales Executive only (parent gates). */
  onVerify?: () => void | Promise<void>;
  verifying?: boolean;
}) {
  const router = useRouter();

  return (
    <div className="mt-7 flex items-center gap-3 border-t border-[var(--crm-border)] pt-6 animate-fade-up">
      <Button
        variant="primary"
        icon="💾"
        disabled={saving}
        onClick={() => onSave && void onSave()}
      >
        {saving ? "Saving…" : "Save Changes"}
      </Button>
      <Button variant="ghost" icon="🖨" onClick={() => window.print()}>
        Print
      </Button>
      {onVerify ? (
        <Button
          variant="outline"
          icon="✓"
          disabled={verifying}
          onClick={() => void onVerify()}
        >
          {verifying ? "Verifying…" : "Verify lead"}
        </Button>
      ) : null}
      <div className="ml-auto">
        <Button variant="ghost" icon="✕" onClick={() => router.push("/Leads")}>
          Close Window
        </Button>
      </div>
    </div>
  );
}
