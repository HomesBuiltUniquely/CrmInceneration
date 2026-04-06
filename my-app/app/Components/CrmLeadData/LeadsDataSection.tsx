"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiLead, SpringPage } from "@/lib/leads-filter";
import { CRM_TOKEN_STORAGE_KEY } from "@/lib/auth/api";
import { asCrmLeadType, mapApiLeadToRow } from "@/lib/leads-filter";
import LeadsTable from "./LeadsTable";
import LeadsToolbar from "./LeadsToolbar";

async function fetchMergedPage(page: number, size: number, token?: string | null): Promise<SpringPage<ApiLead>> {
  const headers: HeadersInit = {};
  if (token) headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

  const res = await fetch(
    `/api/crm/leads?mergeAll=1&page=${page}&size=${size}&sort=updatedAt,desc`,
    { cache: "no-store", credentials: "include", headers }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

function readBearer(): string | null {
  if (typeof window === "undefined") return null;
  const fromLogin = window.localStorage.getItem(CRM_TOKEN_STORAGE_KEY);
  if (fromLogin) return fromLogin;
  for (const k of ["crm_access_token", "access_token", "token", "authToken"]) {
    const v = window.localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

export default function LeadsDataSection() {
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SpringPage<ApiLead> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = readBearer();
      const json = await fetchMergedPage(page, size, token);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, size]);

  useEffect(() => {
    void load();
  }, [load]);

  const content = data?.content ?? [];
  const rows = content.map((lead) => mapApiLeadToRow(lead, asCrmLeadType(lead.leadType, "formlead")));
  const total = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const start = total === 0 ? 0 : page * size + 1;
  const end = Math.min(total, page * size + content.length);

  return (
    <>
      <LeadsToolbar rangeStart={start} rangeEnd={end} totalCount={total} loading={loading} />
      {error ? (
        <div className="mx-auto mt-2 max-w-[1200px] px-6 text-[12px] text-rose-600">
          {error}
          {process.env.NODE_ENV === "development" ? (
            <span className="mt-1 block text-slate-500">
              Set <code className="rounded bg-slate-100 px-1">CRM_DEV_BEARER_TOKEN</code> in{" "}
              <code className="rounded bg-slate-100 px-1">.env.local</code> or store a token in{" "}
              <code className="rounded bg-slate-100 px-1">localStorage</code> as{" "}
              <code className="rounded bg-slate-100 px-1">crm_token</code> (login) or{" "}
              <code className="rounded bg-slate-100 px-1">access_token</code>.
            </span>
          ) : null}
        </div>
      ) : null}
      <LeadsTable
        rows={rows}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPrevPage={() => setPage((p) => Math.max(0, p - 1))}
        onNextPage={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
      />
    </>
  );
}
