import NewLeadDetailPage from "@/app/Components/CrmLeadDetailsV2/NewLeadDetailPage";

export default async function NewLeadDetailRoute({
  params,
}: {
  params: Promise<{ leadType: string; leadId: string }>;
}) {
  const { leadType, leadId } = await params;
  return <NewLeadDetailPage leadType={leadType} leadId={leadId} />;
}
