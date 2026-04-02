import { notFound } from "next/navigation";
import LeadDetailsClient from "@/app/Components/CrmLeadDetails/LeadDetailsClient";
import { getLeadById } from "@/lib/data";

export default async function LeadDetailsPage({
  params,
}: {
  params: Promise<{ leadId: Number }>;
}) {
  const { leadId } = await params;
  const lead = getLeadById(String(leadId));

  if (!lead) {
    notFound();
  }

  return <LeadDetailsClient lead={lead} />;
}
