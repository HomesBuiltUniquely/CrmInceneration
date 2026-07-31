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
  return v > 0 ? "text-green-500" : "text-red-500";
}

export default function InsightsSect6({
  leadsOverTime,
  conversionTrend,
  revenueForecast,
}: Props) {
  const leadPoints = leadsOverTime.points;
  const maxLeadCount = useMemo(() => {
    const counts = leadPoints.map((p) => Number(p.count ?? 0));
    return Math.max(1, ...counts);
  }, [leadPoints]);

  const conversionPoints = conversionTrend.points;
  const conversionPath = useMemo(() => {
    if (conversionPoints.length === 0) return "";
    const width = 320;
    const height = 140;
    const padX = 10;
    const padY = 20;
    const values = conversionPoints.map((p) => Number(p.conversionPercent ?? 0));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1, max - min);
    const step =
      conversionPoints.length === 1
        ? 0
        : (width - padX * 2) / (conversionPoints.length - 1);

    return conversionPoints
      .map((point, index) => {
        const x = padX + index * step;
        const y =
          height -
          padY -
          ((Number(point.conversionPercent ?? 0) - min) / span) *
            (height - padY * 2);
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
    const values = conversionPoints.map((p) => Number(p.conversionPercent ?? 0));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1, max - min);
    const step =
      conversionPoints.length === 1
        ? 0
        : (width - padX * 2) / (conversionPoints.length - 1);
    const index = conversionPoints.length - 1;
    const x = padX + index * step;
    const y =
      height -
      padY -
      ((Number(conversionPoints[index]?.conversionPercent ?? 0) - min) / span) *
        (height - padY * 2);
    return { x, y };
  }, [conversionPoints]);

  const forecastMax = Math.max(
    1,
    revenueForecast.target,
    revenueForecast.actual,
    revenueForecast.projected,
  );
  const actualHeight = Math.round((revenueForecast.actual / forecastMax) * 144);
  const projectedHeight = Math.round(
    (revenueForecast.projected / forecastMax) * 144,
  );
  const projectedFilled = Math.round(
    (Math.min(revenueForecast.actual, revenueForecast.projected) / forecastMax) *
      144,
  );

  return (
    <main className="px-4 lg:px-0">
      <div className="mt-10 flex justify-center pb-10">
        <div className="grid w-full max-w-[1290px] grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-lg xl:max-w-[400px]">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">LEADS OVER</h2>
                <h3 className="text-lg font-bold text-gray-800">TIME</h3>
              </div>
              <span
                className={`font-semibold ${changeTone(leadsOverTime.changePercent)}`}
              >
                {formatInsightsChangePercent(leadsOverTime.changePercent)}
              </span>
            </div>

            {leadPoints.length === 0 ? (
              <p className="mt-8 text-sm text-gray-500">No lead trend data.</p>
            ) : (
              <div className="mt-4 flex h-56 items-end justify-between gap-2">
                {leadPoints.map((item, index) => {
                  const count = Number(item.count ?? 0);
                  const heightPx = Math.max(
                    8,
                    Math.round((count / maxLeadCount) * 200),
                  );
                  const highlight = index >= leadPoints.length - 2;
                  return (
                    <div
                      key={`${item.label}-${index}`}
                      className="flex flex-1 flex-col items-center"
                      title={`${item.label}: ${count}`}
                    >
                      <div
                        className={`w-full max-w-[40px] rounded-sm ${
                          highlight ? "bg-green-500" : "bg-gray-200"
                        }`}
                        style={{ height: `${heightPx}px` }}
                      />
                      <span className="mt-3 text-xs text-gray-500">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-lg xl:max-w-[400px]">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">CONVERSION</h2>
                <h3 className="text-lg font-bold text-gray-800">TREND</h3>
              </div>
              <span
                className={`font-semibold ${changeTone(conversionTrend.changePercent)}`}
              >
                {formatInsightsChangePercent(conversionTrend.changePercent)}
              </span>
            </div>

            {conversionPoints.length === 0 ? (
              <p className="mt-8 text-sm text-gray-500">No conversion trend data.</p>
            ) : (
              <>
                <div className="flex h-44 items-center justify-center">
                  <svg
                    viewBox="0 0 320 140"
                    className="h-auto w-full max-w-[320px]"
                  >
                    <path
                      d={conversionPath}
                      fill="none"
                      stroke="#111827"
                      strokeWidth="3"
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
                <div className="flex justify-between text-xs text-gray-400">
                  {conversionPoints.map((p, i) => (
                    <span key={`${p.label}-${i}`}>{p.label}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-lg xl:max-w-[400px]">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">REVENUE</h2>
                <h3 className="text-lg font-bold text-gray-800">FORECAST</h3>
              </div>
              <span className="text-sm font-semibold text-gray-700">
                TARGET: {formatInsightsInrCompact(revenueForecast.target)}
              </span>
            </div>

            <div className="flex items-end justify-center gap-6">
              <div>
                <div
                  className="w-24 bg-green-500 sm:w-28"
                  style={{ height: `${Math.max(8, actualHeight)}px` }}
                />
                <p className="mt-3 text-center text-sm font-semibold text-gray-700">
                  ACTUAL
                </p>
                <p className="text-center text-xs text-gray-500">
                  {formatInsightsInrCompact(revenueForecast.actual)}
                </p>
              </div>

              <div>
                <div
                  className="relative w-24 bg-gray-200 sm:w-28"
                  style={{ height: `${Math.max(8, projectedHeight)}px` }}
                >
                  <div
                    className="absolute bottom-0 w-full bg-slate-900"
                    style={{ height: `${Math.max(0, projectedFilled)}px` }}
                  />
                </div>
                <p className="mt-3 text-center text-sm font-semibold text-gray-700">
                  PROJECTED
                </p>
                <p className="text-center text-xs text-gray-500">
                  {formatInsightsInrCompact(revenueForecast.projected)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
