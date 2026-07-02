/**
 * Pulls the budget figure from CRM budget labels, e.g.
 * "2 BHK Essential Interiors - 4.0 Lakhs Onwards (...)" → "4.0 Lakhs Onwards"
 * "2 BHK Standard Interiors - 6 Lakhs+" → "6 Lakhs+"
 */
export function extractBudgetDisplayValue(raw: string | null | undefined): string {  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";

  let segment = trimmed;
  const dashIdx = trimmed.indexOf(" - ");
  if (dashIdx >= 0) {
    segment = trimmed.slice(dashIdx + 3).trim();
  }

  const parenIdx = segment.indexOf("(");
  if (parenIdx >= 0) {
    segment = segment.slice(0, parenIdx).trim();
  }

  if (segment) {
    return segment
      .replace(/\s+onwards$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  const match = trimmed.match(
    /(\d+(?:\.\d+)?)\s*(lakhs?|l)\s*(\+|onwards)?/i,
  );
  if (!match) return trimmed;

  const num = match[1];
  const unit = /^l$/i.test(match[2]) ? "L" : "Lakhs";
  const tail = match[3] === "+" ? "+" : /onwards/i.test(match[0]) ? " Onwards" : "";
  return unit === "L" ? `${num}${unit}${tail}` : `${num} ${unit}${tail}`;
}

/** Rupee-prefixed label for Configuration Scope investment card. */
export function formatInvestmentRangeLabel(raw: string | null | undefined): string {
  const value = extractBudgetDisplayValue(raw);
  if (!value) return "—";
  if (value.startsWith("₹")) return value;
  return `₹${value}`;
}

export type BudgetLuxuryFocus = {
  /** 0 = value focus, 100 = luxury focus */
  percent: number;
  note: string;
  tierLabel: string;
};

function normalizeBudgetKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Maps CRM budget dropdown options → Value / Luxury slider (Essential vs Standard). */
export function resolveBudgetLuxuryFocus(
  raw: string | null | undefined,
): BudgetLuxuryFocus {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    return {
      percent: 50,
      tierLabel: "Not set",
      note: "Select a budget on the lead to align value vs luxury focus.",
    };
  }

  const key = normalizeBudgetKey(trimmed);

  if (key.includes("8 lakhs+") || key.includes("8.0 lakhs+")) {
    return {
      percent: 80,
      tierLabel: "Standard — 8 Lakhs+",
      note: "Client prefers luxury finishes in Living Area & Kitchen specifically.",
    };
  }
  if (key.includes("6 lakhs+") && key.includes("standard")) {
    return {
      percent: 68,
      tierLabel: "Standard — 6 Lakhs+",
      note: "Standard interiors — medium to premium finishes in primary spaces.",
    };
  }
  if (key.includes("8.0 lakhs") || (key.includes("8 lakhs") && key.includes("essential"))) {
    return {
      percent: 58,
      tierLabel: "Essential — 8 Lakhs",
      note: "Balanced medium finish — mix of value and upgraded materials.",
    };
  }
  if (key.includes("6.0 lakhs") || (key.includes("6 lakhs") && key.includes("essential"))) {
    return {
      percent: 42,
      tierLabel: "Essential — 6 Lakhs",
      note: "Essential range with modest room to upgrade key areas.",
    };
  }
  if (key.includes("4.0 lakhs") || key.includes("4 lakhs")) {
    return {
      percent: 28,
      tierLabel: "Essential — 4 Lakhs",
      note: "Essential interiors — value-focused finishes with modular basics.",
    };
  }

  const amountMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:lakhs?|l)/i);
  const amount = amountMatch ? Number(amountMatch[1]) : NaN;
  const isStandard = /standard/i.test(trimmed);
  const isPlus = /lakhs?\s*\+|l\+/i.test(trimmed);

  if (isStandard && isPlus && amount >= 8) {
    return resolveBudgetLuxuryFocus("3 BHK Standard Interiors - 8 Lakhs+");
  }
  if (isStandard && isPlus && amount >= 6) {
    return resolveBudgetLuxuryFocus("2 BHK Standard Interiors - 6 Lakhs+");
  }
  if (amount >= 8) {
    return resolveBudgetLuxuryFocus(
      "4 BHK Essential Interiors - 8.0 Lakhs Onwards ( Modular Kitchen, Wardrobes, TV Unit )",
    );
  }
  if (amount >= 6) {
    return resolveBudgetLuxuryFocus(
      "3 BHK Essential Interiors - 6.0 Lakhs Onwards ( Modular Kitchen, Wardrobes, TV Unit )",
    );
  }
  if (amount >= 4) {
    return resolveBudgetLuxuryFocus(
      "2 BHK Essential Interiors - 4.0 Lakhs Onwards ( Modular Kitchen, Wardrobes, TV Unit )",
    );
  }

  return {
    percent: 50,
    tierLabel: "Custom",
    note: "Budget mapped between value and luxury based on selected range.",
  };
}

/** Maps a quoted INR total to the value/luxury slider tiers. */
export function resolveLuxuryFocusFromAmount(amountInr: number): BudgetLuxuryFocus {
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    return resolveBudgetLuxuryFocus("");
  }

  const lakhs = amountInr / 100_000;
  if (lakhs >= 8) {
    return resolveBudgetLuxuryFocus("3 BHK Standard Interiors - 8 Lakhs+");
  }
  if (lakhs >= 6) {
    return resolveBudgetLuxuryFocus(
      "3 BHK Essential Interiors - 6.0 Lakhs Onwards ( Modular Kitchen, Wardrobes, TV Unit )",
    );
  }
  if (lakhs >= 4) {
    return resolveBudgetLuxuryFocus(
      "2 BHK Essential Interiors - 4.0 Lakhs Onwards ( Modular Kitchen, Wardrobes, TV Unit )",
    );
  }

  return {
    percent: 22,
    tierLabel: "Quoted total",
    note: "Quoted amount mapped between value and luxury focus.",
  };
}
