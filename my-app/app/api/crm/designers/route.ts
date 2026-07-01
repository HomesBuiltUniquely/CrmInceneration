import { NextResponse } from "next/server";

type DesignerRow = { id: number; name: string; email: string };

const DESIGN_MODULE_URL = (
  process.env.DESIGN_MODULE_URL?.trim() || "https://api.hubinterior.com"
).replace(/\/+$/, "");

function normalizeDesignerRows(data: unknown): DesignerRow[] {
  const rawList = Array.isArray(data)
    ? data
    : data &&
        typeof data === "object" &&
        "designers" in data &&
        Array.isArray((data as { designers: unknown }).designers)
      ? (data as { designers: unknown[] }).designers
      : [];

  return rawList
    .map((row, index) => {
      const o = row as Record<string, unknown>;
      const name = String(o.name ?? o.leadName ?? o.fullName ?? "").trim();
      const email = String(o.email ?? "").trim();
      const id =
        typeof o.id === "number"
          ? o.id
          : typeof o.id === "string" && /^\d+$/.test(o.id)
            ? Number(o.id)
            : index + 1;
      return { id, name, email };
    })
    .filter((row) => row.name.length > 0);
}

export async function GET() {
  const targetUrl = `${DESIGN_MODULE_URL}/api/designers`;
  console.log(`[CRM /api/crm/designers] → Design Module only: ${targetUrl}`);

  try {
    const res = await fetch(targetUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const text = await res.text();
    console.log(
      `[CRM /api/crm/designers] ← status: ${res.status}, body: ${text.slice(0, 200)}`,
    );

    if (!res.ok || text.trimStart().startsWith("<")) {
      return NextResponse.json(
        {
          designers: [],
          error: `Design Module returned ${res.status}. Check DESIGN_MODULE_URL (use API host, e.g. https://api.hubinterior.com).`,
        },
        { status: 200 },
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          designers: [],
          error: "Design Module returned non-JSON response.",
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      designers: normalizeDesignerRows(data),
      source: "design-module",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[CRM /api/crm/designers] Design Module unreachable: ${message}`);
    return NextResponse.json(
      {
        designers: [],
        error: `Design Module unreachable at ${DESIGN_MODULE_URL}.`,
      },
      { status: 200 },
    );
  }
}
