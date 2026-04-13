"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui";

export default function FooterActions({
  onSave,
  saving,
  onSaveSecondBox,
  savingSecondBox,
  onVerify,
  verifying,
}: {
  onSave?: () => void | Promise<void>;
  saving?: boolean;
  /** Legacy second-box save: additional fields only (`mergeSecondBoxIntoDetail`). */
  onSaveSecondBox?: () => void | Promise<void>;
  savingSecondBox?: boolean;
  /** `POST .../verify/{id}` — Presales Executive / Manager only (parent gates). */
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
      {onSaveSecondBox ? (
        <Button
          variant="outline"
          icon="📋"
          disabled={savingSecondBox || saving}
          onClick={() => void onSaveSecondBox()}
        >
          {savingSecondBox ? "Saving…" : "Save additional info"}
        </Button>
      ) : null}
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
