import NewConfigurationScopePage from "@/app/Components/CrmLeadDetailsV2/NewConfigurationScopePage";

export default async function NewLeadConfigurationScopeRoute({
  params,
}: {
  params: Promise<{ leadType: string; leadId: string }>;
}) {
  const { leadType, leadId } = await params;
  return <NewConfigurationScopePage leadType={leadType} leadId={leadId} />;
}
