"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  leadType: string;
  leadId: string;
};

/** Legacy route — opens booking handoff as a popup on lead details. */
export default function BookingDonePage({ leadType, leadId }: Props) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/Leads/${leadType}/${leadId}?bookingDone=1`);
  }, [leadId, leadType, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef1f5] text-sm text-[#64748b]">
      Opening booking handoff…
    </div>
  );
}
