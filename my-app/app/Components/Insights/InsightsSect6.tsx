"use client";

import { useMemo } from "react";
import {
  formatInsightsChangePercent,
  formatInsightsInrCompact,
  type InsightsDashboard,
} from "@/lib/crm-insights-api";

type Props = {
  leadsOverTime: InsightsDashboard["leadsOverTime"];
  conversionTrend: InsightsDashboard["conversionTrend"];
  revenueForecast: InsightsDashboard["revenueForecast"];
};

function changeTone(value: number | null | undefined): string {
  const v = Number(value ?? 0);
  if (!Number.isFinite(v) || v === 0) return "text-gray-500";
  return v > 0 ? "text-green-600" : "text-red-500";
}

function changeArrow(value: number | null | undefined): string {
  const v = Number(value ?? 0);
  if (!Number.isFinite(v) || v === 0) return "";
  return v > 0 ? "↑ " : "↓ ";
}

export default function InsightsSect6({
  leadsOverTime,
  conversionTrend,
  revenueForecast,
}: Props) {
  const leadPoints = leadsOverTime.points ?? [];
  const maxLeadCount = useMemo(() => {
    const counts = leadPoints.map((p) => Number(p.count ?? 0));
    return Math.max(1, ...counts, 0);
  }, [leadPoints]);

  const conversionPoints = conversionTrend.points ?? [];
  const conversionPath = useMemo(() => {
    if (conversionPoints.length === 0) return "";
    const width = 320;
    const height = 140;
    const padX = 10;
    const padY = 20;
    // Fixed 0–100 scale so empty/zero windows still read as conversion charts
    const values = conversionPoints.map((p) =>
      Math.min(100, Math.max(0, Number(p.conversionPercent ?? 0))),
    );
    const min = 0;
    const max = Math.max(100, ...values);
    const span = Math.max(1, max - min);
    const step =
      conversionPoints.length === 1
        ? 0
        : (width - padX * 2) / (conversionPoints.length - 1);

    return conversionPoints
      .map((_, index) => {
        const x = padX + index * step;
        const y =
          height - padY - ((values[index]! - min) / span) * (height - padY * 2);
        return `${index === 0 ? "M" : "L"}${x} ${y}`;
      })
      .join(" ");
  }, [conversionPoints]);

  const lastConversionPoint = useMemo(() => {
    if (conversionPoints.length === 0) return null;
    const width = 320;
    const height = 140;
    const padX = 10;
    const padY = 20;
    const values = conversionPoints.map((p) =>
      Math.min(100, Math.max(0, Number(p.conversionPercent ?? 0))),
    );
    const min = 0;
    const max = Math.max(100, ...values);
    const span = Math.max(1, max - min);
    const step =
      conversionPoints.length === 1
        ? 0
        : (width - padX * 2) / (conversionPoints.length - 1);
    const index = conversionPoints.length - 1;
    const x = padX + index * step;
    const y =
      height - padY - ((values[index]! - min) / span) * (height - padY * 2);
    return { x, y };
  }, [conversionPoints]);

  const target = Number(revenueForecast?.target ?? 0) || 0;
  const actual = Number(revenueForecast?.actual ?? 0) || 0;
  const projected = Number(revenueForecast?.projected ?? 0) || 0;
  const forecastMax = Math.max(1, target, actual, projected);
  const bar = (v: number) => Math.max(8, Math.round((v / forecastMax) * 144));

  return (
    <main className="px-4 lg:px-0">
      <div className="mt-10 flex justify-center pb-10">
        <div className="grid w-full max-w-[1290px] grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {/* A) Leads over time — Hub leadsOverTime only */}
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-lg xl:max-w-[400px]">
            <div className="mb-5 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Leads over time</h2>
                <p className="mt-0.5 text-[11px] font-medium text-gray-400">
                  From dashboard · date / branch / people scoped
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full bg-gray-50 px-2.5 py-1 text-sm font-semibold tabular-nums ${changeTone(leadsOverTime.changePercent)}`}
                title="vs previous equal-length period"
              >
                {changeArrow(leadsOverTime.changePercent)}
                {formatInsightsChangePercent(leadsOverTime.changePercent)}
              </span>
            </div>

            {leadPoints.length === 0 ? (
              <p className="mt-8 text-sm text-gray-500">
                No leads-over-time points for this filter.
              </p>
            ) : (
              <div className="mt-4 flex h-56 items-end justify-between gap-1.5 sm:gap-2">
                {leadPoints.map((item, index) => {
                  const count = Number(item.count ?? 0);
                  const heightPx = Math.max(
                    count > 0 ? 8 : 4,
                    Math.round((count / maxLeadCount) * 200),
                  );
                  const highlight = index >= leadPoints.length - 2;
                  return (
                    <div
                      key={`${item.label}-${index}`}
                      className="flex min-w-0 flex-1 flex-col items-center"
                      title={`${item.label}: ${count}`}
                    >
                      <div
                        className={`w-full max-w-[40px] rounded-sm transition-colors ${
                          highlight ? "bg-green-500" : "bg-gray-200"
                        }`}
                        style={{ height: `${heightPx}px` }}
                      />
                      <span className="mt-2 max-w-full truncate text-center text-[10px] uppercase tracking-wide text-gray-500 sm:text-xs">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* B) Conversion trend — Hub conversionTrend only */}
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-lg xl:max-w-[400px]">
            <div className="mb-5 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Conversion trend</h2>
                <p className="mt-0.5 text-[11px] font-medium text-gray-400">
                  Last bucket % − first (Hub)
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full bg-gray-50 px-2.5 py-1 text-sm font-semibold tabular-nums ${changeTone(conversionTrend.changePercent)}`}
                title="last bucket conversion − first bucket"
              >
                {changeArrow(conversionTrend.changePercent)}
                {formatInsightsChangePercent(conversionTrend.changePercent)}
              </span>
            </div>

            {conversionPoints.length === 0 ? (
              <p className="mt-8 text-sm text-gray-500">
                No conversion trend points for this filter.
              </p>
            ) : (
              <>
                <div className="flex h-44 items-center justify-center">
                  <svg
                    viewBox="0 0 320 140"
                    className="h-auto w-full max-w-[320px]"
                    role="img"
                    aria-label="Conversion trend line"
                  >
                    <path
                      d={conversionPath}
                      fill="none"
                      stroke="#111827"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {lastConversionPoint ? (
                      <circle
                        cx={lastConversionPoint.x}
                        cy={lastConversionPoint.y}
                        r="5"
                        fill="#22c55e"
                      />
                    ) : null}
                  </svg>
                </div>
                <div className="flex justify-between gap-1 text-[10px] uppercase tracking-wide text-gray-400 sm:text-xs">
                  {conversionPoints.map((p, i) => (
                    <span
                      key={`${p.label}-${i}`}
                      className="min-w-0 truncate text-center"
                      title={`${p.label}: ${Number(p.conversionPercent ?? 0).toFixed(1)}%`}
                    >
                      {p.label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* C) Revenue forecast — Hub only (not Incentives target) */}
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-lg xl:max-w-[400px]">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800">Revenue forecast</h2>
              <p className="mt-0.5 text-[11px] font-medium text-gray-400">
                Hub actual / projected / target (Insight heuristic)
              </p>
            </div>

            <div className="flex items-end justify-center gap-4 sm:gap-5">
              <div className="flex flex-col items-center">
                <div
                  className="w-16 rounded-t-sm bg-green-500 sm:w-20"
                  style={{ height: `${bar(actual)}px` }}
                  title={`Actual ${formatInsightsInrCompact(actual)}`}
                />
                <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-700">
                  Actual
                </p>
                <p className="text-center text-xs tabular-nums text-gray-500">
                  {formatInsightsInrCompact(actual)}
                </p>
              </div>

              <div className="flex flex-col items-center">
                <div
                  className="w-16 rounded-t-sm bg-slate-800 sm:w-20"
                  style={{ height: `${bar(projected)}px` }}
                  title={`Projected ${formatInsightsInrCompact(projected)}`}
                />
                <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-700">
                  Projected
                </p>
                <p className="text-center text-xs tabular-nums text-gray-500">
                  {formatInsightsInrCompact(projected)}
                </p>
              </div>

              <div className="flex flex-col items-center">
                <div
                  className="w-16 rounded-t-sm bg-gray-200 sm:w-20"
                  style={{ height: `${bar(target)}px` }}
                  title={`Target ${formatInsightsInrCompact(target)}`}
                />
                <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-700">
                  Target
                </p>
                <p className="text-center text-xs tabular-nums text-gray-500">
                  {formatInsightsInrCompact(target)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
