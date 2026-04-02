import { NextResponse } from "next/server";

const BACKEND_URL = "http://localhost:9090/Milestone/count";

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

export async function GET() {
  try {
    const response = await fetch(BACKEND_URL, {
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
