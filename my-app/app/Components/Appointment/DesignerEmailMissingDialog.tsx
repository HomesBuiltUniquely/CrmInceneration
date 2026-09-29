"use client";

type DesignerEmailMissingDialogProps = {
  open: boolean;
  designerName: string;
  onClose: () => void;
};

export default function DesignerEmailMissingDialog({
  open,
  designerName,
  onClose,
}: DesignerEmailMissingDialogProps) {
  if (!open) return null;

  const displayName = designerName.trim() || "This designer";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="designer-email-missing-title"
      aria-describedby="designer-email-missing-desc"
    >
      <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-5 shadow-xl">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-xl" aria-hidden>
          ✉
        </div>
        <h2
          id="designer-email-missing-title"
          className="text-lg font-semibold text-slate-900"
        >
          Designer email not added to meeting
        </h2>
        <p id="designer-email-missing-desc" className="mt-2 text-sm leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">{displayName}</span> has no email in{" "}
          <span className="font-medium">Design Module</span>. The Hub meeting was{" "}
          <span className="font-semibold text-rose-700">not</span> created — Google Calendar cannot
          invite this designer.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Add or fix their email in Design Module (Users), then schedule again. CRM old designer
          records are not used for meeting invites.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            OK, got it
          </button>
        </div>
      </div>
    </div>
  );
}
