import { notFound } from "next/navigation";
import LeadDetailsApiClient from "@/app/Components/CrmLeadDetails/LeadDetailsApiClient";
import LeadDetailsClient from "@/app/Components/CrmLeadDetails/LeadDetailsClient";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { getLeadById } from "@/lib/data";

/** One route tree for `/Leads/*` so Next.js does not see `[leadId]` vs `[leadType]` at the same depth. */
export default async function LeadDetailsPage({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;
  if (!segments?.length) {
    notFound();
  }

  if (segments.length === 1) {
    const slug = segments[0];
    const mock = getLeadById(slug);
    if (mock) {
      return <LeadDetailsClient lead={mock} />;
    }
    if (/^\d+$/.test(slug)) {
      return <LeadDetailsApiClient leadType="formlead" leadId={slug} />;
    }
    notFound();
  }

  if (segments.length === 2) {
    const [a, b] = segments;
    if (isCrmLeadType(a) && /^\d+$/.test(b)) {
      return <LeadDetailsApiClient leadType={a} leadId={b} />;
    }
    notFound();
  }

  notFound();
}
