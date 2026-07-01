import { Suspense } from "react";
import { notFound } from "next/navigation";
import LeadDetailsClient from "@/app/Components/CrmLeadDetails/LeadDetailsClient";
import NewLeadDetailApiClient from "@/app/Components/CrmLeadDetailsV2/NewLeadDetailApiClient";
import NewConfigurationScopePage from "@/app/Components/CrmLeadDetailsV2/NewConfigurationScopePage";
import BookingDonePage from "@/app/Components/CrmLeadDetailsV2/BookingDonePage";
import SalesOnlyLeadV2Gate from "@/app/Components/CrmLeadDetailsV2/SalesOnlyLeadV2Gate";
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
      return <NewLeadDetailApiClient leadType="formlead" leadId={slug} />;
    }
    notFound();
  }

  if (segments.length === 2) {
    const [a, b] = segments;
    if (isCrmLeadType(a) && /^\d+$/.test(b)) {
      return <NewLeadDetailApiClient leadType={a} leadId={b} />;
    }
    notFound();
  }

  if (segments.length === 3) {
    const [leadType, leadId, tail] = segments;
    if (
      isCrmLeadType(leadType) &&
      /^\d+$/.test(leadId) &&
      tail === "configuration-scope"
    ) {
      return (
        <SalesOnlyLeadV2Gate leadType={leadType} leadId={leadId}>
          <NewConfigurationScopePage leadType={leadType} leadId={leadId} />
        </SalesOnlyLeadV2Gate>
      );
    }
    if (
      isCrmLeadType(leadType) &&
      /^\d+$/.test(leadId) &&
      tail === "booking-done"
    ) {
      return (
        <SalesOnlyLeadV2Gate leadType={leadType} leadId={leadId}>
          <Suspense fallback={null}>
            <BookingDonePage leadType={leadType} leadId={leadId} />
          </Suspense>
        </SalesOnlyLeadV2Gate>
      );
    }
    notFound();
  }

  notFound();
}
