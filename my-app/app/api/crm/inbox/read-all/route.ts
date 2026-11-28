import type { NextRequest } from "next/server";
import { proxyCrmInboxPost } from "@/lib/crm-inbox-hub-proxy";

export async function POST(req: NextRequest) {
  return proxyCrmInboxPost(req, "/v1/crm/inbox/read-all");
}