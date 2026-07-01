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
  /** `POST .../verify/{id}` — role-gated in parent (Super Admin / Presales Manager / Presales Executive). */
  onVerify?: () => void | Promise<void>;
  verifying?: boolean;
}) {
  const router = useRouter();
  const handleCloseWindow = () => {
    if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/Leads");
  };

  return (
    <div className="mt-7 flex items-center gap-3 border-t border-[var(--crm-border)] pt-6 animate-fade-up">
      <Button
        variant="primary"
        icon="💾"
        disabled={saving}
        onClick={() => onSave && void onSave()}
        className="transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(59,130,246,0.28)]"
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
        <Button
          variant="ghost"
          icon="✕"
          onClick={handleCloseWindow}
        >
          Close Window
        </Button>
      </div>
    </div>
  );
}
