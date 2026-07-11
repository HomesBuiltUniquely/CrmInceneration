export default function InsightSect6() {
  const chartData = [
    { day: "MON", height: 70 },
    { day: "TUE", height: 120 },
    { day: "WED", height: 110 },
    { day: "THU", height: 170 },
    { day: "FRI", height: 145 },
    { day: "SAT", height: 215 },
    { day: "SUN", height: 190 },
  ];

  return (
    <main className="px-4 lg:px-0">
      <div className="mt-10 flex justify-center">
        <div className="grid w-full max-w-[1290px] grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">

          {/* Leads Over Time */}
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-lg xl:max-w-[400px]">

            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  LEADS OVER
                </h2>
                <h3 className="text-lg font-bold text-gray-800">
                  TIME
                </h3>
              </div>

              <span className="font-semibold text-green-500">
                +14%
              </span>
            </div>

            <div className="mt-4 flex h-56 items-end justify-between gap-2">
              {chartData.map((item, index) => (
                <div
                  key={item.day}
                  className="flex flex-1 flex-col items-center"
                >
                  <div
                    className={`w-full max-w-[40px] rounded-sm ${
                      index >= 5 ? "bg-green-500" : "bg-gray-200"
                    }`}
                    style={{
                      height: `${item.height}px`,
                    }}
                  />

                  <span className="mt-3 text-xs text-gray-500">
                    {item.day}
                  </span>
                </div>
              ))}
            </div>

          </div>

          {/* Conversion Trend */}
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-lg xl:max-w-[400px]">

            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  CONVERSION
                </h2>

                <h3 className="text-lg font-bold text-gray-800">
                  TREND
                </h3>
              </div>

              <span className="font-semibold text-red-500">
                -2%
              </span>
            </div>

            <div className="flex h-44 items-center justify-center">

              <svg
                viewBox="0 0 320 140"
                className="h-auto w-full max-w-[320px]"
              >
                <path
                  d="M10 110
                     C70 90,
                     110 120,
                     160 80
                     S250 40,
                     310 60"
                  fill="none"
                  stroke="#111827"
                  strokeWidth="3"
                />

                <circle
                  cx="310"
                  cy="60"
                  r="5"
                  fill="#22c55e"
                />
              </svg>

            </div>

            <div className="flex justify-between text-xs text-gray-400">
              <span>WEEK 1</span>
              <span>WEEK 2</span>
              <span>WEEK 3</span>
              <span>WEEK 4</span>
            </div>

          </div>

          {/* Revenue Forecast */}
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-lg xl:max-w-[400px]">

            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  REVENUE
                </h2>

                <h3 className="text-lg font-bold text-gray-800">
                  FORECAST
                </h3>
              </div>

              <span className="text-sm font-semibold text-gray-700">
                TARGET: ₹15M
              </span>

            </div>

            <div className="flex items-end justify-center gap-6">

              <div>
                <div className="h-36 w-24 bg-green-500 sm:w-28"></div>

                <p className="mt-3 text-center text-sm font-semibold text-gray-700">
                  ACTUAL
                </p>
              </div>
              

              <div>
                <div className="relative h-36 w-24 bg-gray-200 sm:w-28">
                  <div className="absolute bottom-0 h-20 w-full bg-slate-900"></div>
                </div>

                <p className="mt-3 text-center text-sm font-semibold text-gray-700">
                  PROJECTED
                </p>
              </div>

            </div>

          </div>

        </div>
      </div>
    </main>
  );
}