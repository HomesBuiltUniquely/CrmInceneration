import { NextRequest } from "next/server";
import { proxyNotifyGet } from "@/lib/crm-notify-proxy";

export async function GET(req: NextRequest) {
  return proxyNotifyGet(req, "/v1/meetings/success");
}
