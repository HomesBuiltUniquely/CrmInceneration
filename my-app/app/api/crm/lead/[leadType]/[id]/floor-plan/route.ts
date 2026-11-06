import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { FLOOR_PLAN_MAX_FILES, crmLeadTypeToFloorPlanLeadType } from "@/lib/floor-plan";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

/**
 * Next/undici FormData parts sometimes fail `instanceof File` / `instanceof Blob`
 * across realms. Duck-type size/name/type so mobile uploads are not dropped as
 * "Missing file" when the multipart body is present.
 */
function toUploadFile(entry: FormDataEntryValue): File | null {
  if (typeof entry === "string") return null;

  const part = entry as Blob & { name?: string; size?: number; type?: string };
  const size = typeof part.size === "number" ? part.size : 0;
  if (size <= 0) return null;

  const name =
    typeof part.name === "string" && part.name.trim()
      ? part.name.trim()
      : "floor-plan.bin";
  const type =
    typeof part.type === "string" && part.type.trim()
      ? part.type.trim()
      : "application/octet-stream";

  if (typeof File !== "undefined" && entry instanceof File) {
    return entry;
  }

  try {
    return new File([part], name, { type });
  } catch {
    return null;
  }
}

function collectFloorPlanFiles(form: FormData): File[] {
  const files: File[] = [];
  for (const field of ["file", "files"] as const) {
    for (const entry of form.getAll(field)) {
      const file = toUploadFile(entry);
      if (file) files.push(file);
    }
  }
  // Fallback: some clients send a single unnamed blob under another key.
  if (files.length === 0) {
    for (const [key, entry] of form.entries()) {
      if (key === "file" || key === "files") continue;
      const file = toUploadFile(entry);
      if (file) files.push(file);
    }
  }
  return files;
}

function describeFormParts(form: FormData): string {
  const parts: string[] = [];
  for (const [key, entry] of form.entries()) {
    if (typeof entry === "string") {
      parts.push(`${key}=string(${entry.length})`);
      continue;
    }
    const part = entry as Blob & { name?: string; size?: number; type?: string };
    parts.push(
      `${key}=blob(size=${part.size ?? "?"},name=${part.name ?? "?"},type=${part.type || "?"})`,
    );
  }
  return parts.join(", ") || "(empty)";
}

function floorPlanUpstreamUrl(leadType: string, id: string): string {
  const segment = crmLeadTypeToFloorPlanLeadType(
    leadType as Parameters<typeof crmLeadTypeToFloorPlanLeadType>[0],
  );
  return `${BASE_URL}/v1/leads/${segment}/${id}/floor-plan`;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> },
) {
  try {
    const { leadType, id } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }
    const res = await fetch(floorPlanUpstreamUrl(leadType, id), {
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(
        res.status,
        payload,
        "Unable to load floor plan. Please try again.",
      );
    }
    return new NextResponse(payload.text, {
      status: res.status,
      headers: { "Content-Type": payload.contentType },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load floor plan. Please try again.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> },
) {
  try {
    const { leadType, id } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }
    const incoming = await req.formData();
    const files = collectFloorPlanFiles(incoming);
    if (files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing file",
          debugMessage: `No uploadable file/files part. Received: ${describeFormParts(incoming)}`,
        },
        { status: 400 },
      );
    }
    if (files.length > FLOOR_PLAN_MAX_FILES) {
      return NextResponse.json(
        { success: false, error: `Up to ${FLOOR_PLAN_MAX_FILES} floor plans are allowed.` },
        { status: 400 },
      );
    }
    const upstreamForm = new FormData();
    if (files.length === 1) {
      upstreamForm.append("file", files[0]!, files[0]!.name);
    } else {
      for (const file of files) upstreamForm.append("files", file, file.name);
    }

    const res = await fetch(floorPlanUpstreamUrl(leadType, id), {
      method: "POST",
      headers: upstreamAuthHeaders(req),
      body: upstreamForm,
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(
        res.status,
        payload,
        "Unable to upload floor plan. Please try again.",
      );
    }
    return new NextResponse(payload.text, {
      status: res.status,
      headers: { "Content-Type": payload.contentType },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to upload floor plan. Please try again.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> },
) {
  try {
    const { leadType, id } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }
    const upstreamUrl = new URL(floorPlanUpstreamUrl(leadType, id));
    const index = req.nextUrl.searchParams.get("index");
    if (index != null && index.trim() !== "") upstreamUrl.searchParams.set("index", index.trim());
    const res = await fetch(upstreamUrl, {
      method: "DELETE",
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(
        res.status,
        payload,
        "Unable to remove floor plan. Please try again.",
      );
    }
    return new NextResponse(payload.text, {
      status: res.status,
      headers: { "Content-Type": payload.contentType },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to remove floor plan. Please try again.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
