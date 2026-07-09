export default function InsightSect4() {
  const dropReasons = [
    { reason: "Budget Mismatch", count: 142, percentage: 42 },
    { reason: "Competitor Selected", count: 86, percentage: 25 },
    { reason: "Timeline Conflict", count: 48, percentage: 14 },
    { reason: "Location Constraints", count: 32, percentage: 9 },
  ];

  const stageVelocity = [
    {
      phase: "Discovery → Connection",
      duration: "1.2 Days",
      trend: "-0.4d",
      color: "text-green-600",
    },
    {
      phase: "Connection → Design Meeting",
      duration: "4.5 Days",
      trend: "+1.2d",
      color: "text-red-600",
    },
    {
      phase: "Design → Proposal",
      duration: "7.8 Days",
      trend: "-2.1d",
      color: "text-green-600",
    },
    {
      phase: "Proposal → Closed Won",
      duration: "14.2 Days",
      trend: "0.0d",
      color: "text-gray-500",
    },
  ];

  return (
    <main className="px-4 lg:px-0">
      <div className="mt-10 flex justify-center">
        <div className="flex w-full max-w-[1320px] flex-col gap-6 lg:flex-row lg:gap-8">

          {/* Drop Reason Analysis */}
          <div className="w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-md sm:p-6 lg:w-[720px] lg:p-7">

            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">
                Drop Reason Analysis
              </h2>

              <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
                326 Total
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[600px] w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-400">
                    <th className="px-3 py-4">Reason</th>
                    <th className="py-4">Count</th>
                    <th className="py-4">Percentage</th>
                  </tr>
                </thead>

                <tbody>
                  {dropReasons.map((item) => (
                    <tr
                      key={item.reason}
                      className="transition-colors hover:bg-gray-50"
                    >
                      <td className="border-b border-gray-100 px-3 py-5 font-medium text-gray-700">
                        {item.reason}
                      </td>

                      <td className="border-b border-gray-100 font-semibold text-gray-900">
                        {item.count}
                      </td>

                      <td className="border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                            {item.percentage}%
                          </span>

                          <div className="h-2.5 flex-1 rounded-full bg-gray-100">
                            <div
                              className="h-2.5 rounded-full bg-red-500"
                              style={{
                                width: `${item.percentage}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

          {/* Stage Velocity */}
          <div className="w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-md sm:p-6 lg:w-[560px] lg:p-7">

            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">
                Stage Velocity
              </h2>

              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600">
                Avg Days
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[500px] w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-400">
                    <th className="px-3 py-4">Sales Phase</th>
                    <th className="py-4">Duration</th>
                    <th className="py-4">Trend</th>
                  </tr>
                </thead>

                <tbody>
                  {stageVelocity.map((item) => (
                    <tr
                      key={item.phase}
                      className="transition-colors hover:bg-gray-50"
                    >
                      <td className="border-b border-gray-100 px-3 py-5 text-gray-700">
                        {item.phase}
                      </td>

                      <td className="border-b border-gray-100 font-semibold text-gray-900">
                        {item.duration}
                      </td>

                      <td className="border-b border-gray-100">
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${
                            item.color === "text-green-600"
                              ? "bg-green-50 text-green-600"
                              : item.color === "text-red-600"
                              ? "bg-red-50 text-red-600"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {item.trend}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      </div>
    </main>
  );
}