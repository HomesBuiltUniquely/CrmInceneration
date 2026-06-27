export type CrmLeadsInvalidateDetail = {
  /** Lead type keys to refetch (e.g. after cross-merge into WhatsApp). */
  leadTypes?: string[];
  reason?: "cross-merge-whatsapp" | "create" | "import" | "presales-milestone";
};

/** Broadcast list + tile count refresh — listened by `LeadsDataSection`. */
export function dispatchCrmLeadsInvalidate(detail?: CrmLeadsInvalidateDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CrmLeadsInvalidateDetail>("crm:leads-invalidate", { detail }));
}
