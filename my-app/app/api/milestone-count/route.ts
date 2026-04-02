import { NextResponse } from "next/server";

const COUNT_URL = "http://localhost:9090/Milestone/count";
const SUB_STATUS_URL = "http://localhost:9090/Milestone/sub-status";

type MilestoneCountMap = Record<string, number>;

function normalizeCounts(data: unknown): MilestoneCountMap {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  return Object.entries(data).reduce<MilestoneCountMap>((result, [key, value]) => {
    if (typeof value === "number") {
      result[key] = value;
    }

    return result;
  }, {});
}

function normalizeSubStatuses(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data.reduce<string[]>((result, item) => {
      if (typeof item === "string" && item.trim().length > 0) {
        result.push(item.trim());
        return result;
      }

      if (!item || typeof item !== "object") {
        return result;
      }

      const candidate =
        ("subStatus" in item && typeof item.subStatus === "string" && item.subStatus) ||
        ("status" in item && typeof item.status === "string" && item.status) ||
        ("label" in item && typeof item.label === "string" && item.label) ||
        ("name" in item && typeof item.name === "string" && item.name) ||
        "";

      if (candidate.trim().length > 0) {
        result.push(candidate.trim());
      }

      return result;
    }, []);
  }

  if (data && typeof data === "object") {
    return Object.values(data).reduce<string[]>((result, value) => {
      if (typeof value === "string" && value.trim().length > 0) {
        result.push(value.trim());
      }

      return result;
    }, []);
  }

  return [];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const resource = searchParams.get("resource");
    const isSubStatusRequest = resource === "sub-status";
    const backendUrl = isSubStatusRequest ? SUB_STATUS_URL : COUNT_URL;

    const response = await fetch(backendUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Backend request failed." },
        { status: response.status },
      );
    }

    const rawData: unknown = await response.json();

    if (isSubStatusRequest) {
      const subStatuses = normalizeSubStatuses(rawData);
      return NextResponse.json({ subStatuses });
    }

    const counts = normalizeCounts(rawData);
    return NextResponse.json({ counts });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not connect to backend.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
