/** Unwrap common Spring / custom envelope shapes to a plain array. */
export function normalizeToArray<T extends Record<string, unknown>>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["data", "users", "content", "items", "result", "records", "rows"]) {
      const v = o[key];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

export function pickNumber(obj: unknown, keys: string[]): number | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}
