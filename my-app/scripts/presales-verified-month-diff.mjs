#!/usr/bin/env node
/**
 * Compare web vs mobile verified-this-month leads for a presales JWT.
 *
 * Usage:
 *   CRM_BEARER_TOKEN='<token from browser Network tab>' \
 *     node scripts/presales-verified-month-diff.mjs
 *
 * Get token: DevTools → Network → /api/crm/leads → Request Headers → Authorization
 */

const BFF = process.env.CRM_BFF_URL ?? "https://crm-inceneration.vercel.app";
const TOKEN = process.env.CRM_BEARER_TOKEN ?? "";

if (!TOKEN) {
  console.error("Set CRM_BEARER_TOKEN (Bearer value, with or without 'Bearer ' prefix).");
  process.exit(1);
}

const auth = TOKEN.startsWith("Bearer ") ? TOKEN : `Bearer ${TOKEN}`;

function parseLeadTs(v) {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const t = Date.parse(s.replace(/^(\d{4}-\d{2}-\d{2}) (\d)/, "$1T$2"));
  return Number.isNaN(t) ? 0 : t;
}

function leadAssignedMs(lead) {
  const r = lead;
  const df =
    r.dynamicFields && typeof r.dynamicFields === "object" && !Array.isArray(r.dynamicFields)
      ? r.dynamicFields
      : null;
  const keys = ["assignedAt", "assignmentDate", "assignDate", "assignedOn", "lastAssignedAt"];
  let max = 0;
  for (const k of keys) {
    max = Math.max(max, parseLeadTs(r[k]));
    if (df) max = Math.max(max, parseLeadTs(df[k]));
  }
  return max;
}

function isThisMonth(ts) {
  if (!ts) return false;
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function pickScalar(lead, keys) {
  const r = lead;
  for (const k of keys) {
    if (!(k in r)) continue;
    const v = r[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  const df = lead.dynamicFields;
  if (df && typeof df === "object" && !Array.isArray(df)) {
    for (const k of keys) {
      if (!(k in df)) continue;
      const v = df[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
  }
  return undefined;
}

function isVerified(lead) {
  const rawVs = pickScalar(lead, [
    "verificationStatus",
    "verification_status",
    "verifyStatus",
    "leadVerificationStatus",
  ]);
  const vs = String(rawVs ?? lead.verificationStatus ?? "").trim().toLowerCase();
  if (["verified", "true", "1", "yes", "complete", "done"].includes(vs)) return true;
  if (["unverified", "false", "0", "no", "pending"].includes(vs)) return false;
  for (const k of ["verified", "isVerified", "is_verified", "leadVerified", "presalesVerified"]) {
    const v = pickScalar(lead, [k]);
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "yes", "1", "verified"].includes(s)) return true;
      if (["false", "no", "0", "unverified"].includes(s)) return false;
    }
    if (typeof v === "number") {
      if (v === 1) return true;
      if (v === 0) return false;
    }
  }
  return lead.verified === true;
}

function mergeLeadsById(leads) {
  const byId = new Map();
  for (const lead of leads) {
    const id = lead.id !== undefined && lead.id !== null ? String(lead.id) : "";
    if (!id || byId.has(id)) continue;
    byId.set(id, lead);
  }
  return [...byId.values()];
}

function leadLabel(lead) {
  const id = lead.id != null ? String(lead.id) : "?";
  const biz =
    lead.leadId ?? lead.leadIdentifier ?? lead.lead_identifier ?? lead.uniqueId ?? "";
  const name = lead.name ?? lead.customerName ?? "";
  const type = lead.leadType ?? lead.type ?? "";
  return `hubId=${id} leadId=${biz} name=${name} type=${type}`;
}

async function fetchAllPages() {
  const all = [];
  for (let page = 0; page < 200; page++) {
    const qs = new URLSearchParams({
      mergeAll: "1",
      leadPool: "presales",
      milestoneScope: "crm",
      leadType: "all",
      page: String(page),
      size: "500",
      sort: "updatedAt,desc",
    });
    const res = await fetch(`${BFF}/api/crm/leads?${qs}`, {
      headers: { Authorization: auth, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`BFF HTTP ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    const chunk = Array.isArray(json.content) ? json.content : [];
    if (!chunk.length) break;
    all.push(...chunk);
    const totalPages = Math.max(1, Number(json.totalPages ?? 1));
    if (page + 1 >= totalPages) break;
    if (chunk.length < 500) break;
  }
  return mergeLeadsById(all);
}

function mobileSimDropReason(lead) {
  const id = lead.id != null ? String(lead.id).trim() : "";
  if (!id) return "no Hub id on row";
  return null;
}

async function main() {
  const pool = await fetchAllPages();
  const monthVerified = pool.filter((l) => isThisMonth(leadAssignedMs(l)) && isVerified(l));

  console.log(`Pool: ${pool.length} leads`);
  console.log(`Verified this month (web rules): ${monthVerified.length}`);
  console.log("---");

  const mobileDropped = [];
  for (const lead of monthVerified) {
    const reason = mobileSimDropReason(lead);
    if (reason) mobileDropped.push({ lead, reason });
  }

  if (mobileDropped.length) {
    console.log("Would be MISSING on mobile:");
    for (const { lead, reason } of mobileDropped) {
      console.log(`  - ${leadLabel(lead)} | ${reason}`);
    }
  } else {
    console.log("All web verified-month leads have Hub id (mobile should match after fixes).");
    console.log("Verified-month leads:");
    for (const lead of monthVerified) {
      const vs = pickScalar(lead, ["verificationStatus"]) ?? lead.verificationStatus ?? "";
      const assigned = leadAssignedMs(lead);
      console.log(
        `  - ${leadLabel(lead)} | vs=${vs} assigned=${assigned ? new Date(assigned).toISOString() : "none"}`,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
