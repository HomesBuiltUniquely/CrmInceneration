"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui";

export default function FooterActions({
  onSave,
  saving,
}: {
  onSave?: () => void | Promise<void>;
  saving?: boolean;
}) {
  const router = useRouter();

  return (
    <div className="mt-7 flex items-center gap-3 border-t border-slate-200 pt-6 animate-fade-up">
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
      <div className="ml-auto">
        <Button variant="ghost" icon="✕" onClick={() => router.push("/Leads")}>
          Close Window
        </Button>
      </div>
    </div>
  );
}
