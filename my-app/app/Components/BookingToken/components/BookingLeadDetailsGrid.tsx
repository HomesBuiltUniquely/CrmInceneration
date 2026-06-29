import type { BookingLeadDetails } from "@/lib/booking-token-lead-details";

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[4.5rem] flex-col justify-center rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">{label}</p>
      <p className="mt-1 break-words text-[13px] font-semibold leading-snug text-[#111827]" title={value}>
        {value}
      </p>
    </div>
  );
}

type Props = {
  details: BookingLeadDetails;
  loading?: boolean;
};

export default function BookingLeadDetailsGrid({ details, loading = false }: Props) {
  if (loading) {
    return <p className="text-sm text-[#6b7280]">Loading lead details…</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <InfoCard label="Lead name" value={details.name} />
      <InfoCard label="PIN" value={details.pincode} />
      <InfoCard label="Assigned to" value={details.assignee} />
      <InfoCard label="Designer assigned" value={details.designerName} />
      <InfoCard label="Email" value={details.email} />
      <InfoCard label="Phone number" value={details.phone} />
    </div>
  );
}
