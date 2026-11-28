import type { NextRequest } from "next/server";
import { proxyCrmInboxGet } from "@/lib/crm-inbox-hub-proxy";

export async function GET(req: NextRequest) {
  return proxyCrmInboxGet(req, "/v1/crm/inbox");
}