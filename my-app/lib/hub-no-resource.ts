/** Spring `NoResourceFoundException` — route not deployed on Hub yet. */
export function isHubNoResourcePayload(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  const rec = json as Record<string, unknown>;
  const err = String(rec.error ?? rec.message ?? "").toLowerCase();
  const type = String(rec.type ?? "").toLowerCase();
  return err.includes("no static resource") || type.includes("noresourcefound");
}

export function isHubNoResourceResponse(status: number, bodyText: string): boolean {
  if (status === 404) return true;
  if (status < 400) return false;
  try {
    return isHubNoResourcePayload(JSON.parse(bodyText));
  } catch {
    return bodyText.toLowerCase().includes("no static resource");
  }
}
