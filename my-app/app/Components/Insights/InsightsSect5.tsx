export default function InsightSect5() {
  const team = [
    {
      name: "Arjun Sharma",
      role: "Senior Associate",
      leads: 242,
      meetings: 118,
      proposals: 45,
      closed: 18,
      value: "₹4.2M",
      conversion: "21.4%",
      status: "good",
    },
    {
      name: "Priya Verma",
      role: "Key Accounts",
      leads: 198,
      meetings: 94,
      proposals: 38,
      closed: 14,
      value: "₹3.8M",
      conversion: "19.2%",
      status: "good",
    },
    {
      name: "Rohan Mehta",
      role: "Associate",
      leads: 312,
      meetings: 102,
      proposals: 29,
      closed: 9,
      value: "₹2.1M",
      conversion: "8.8%",
      status: "poor",
    },
  ];

  return (
    <main className="px-4 lg:px-0">
      <div className="mt-10 flex justify-center">
        <div className="w-full max-w-[1290px] rounded-2xl border border-gray-100 bg-white shadow-md">

          {/* Header */}
          <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">

            <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">
              Team Performance Matrix
            </h2>

            <div className="flex overflow-hidden rounded-lg border border-gray-200 self-start sm:self-auto">
              <button className="bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                Daily
              </button>

              <button className="bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                Monthly
              </button>
            </div>
          </div>

          {/* Responsive Table */}
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-8 py-4">Salesperson</th>
                  <th className="py-4">Leads</th>
                  <th className="py-4">Meetings</th>
                  <th className="py-4">Proposals</th>
                  <th className="py-4">Closed</th>
                  <th className="py-4">Value</th>
                  <th className="py-4">Conv %</th>
                </tr>
              </thead>

              <tbody>
                {team.map((member) => (
                  <tr
                    key={member.name}
                    className="transition-colors hover:bg-gray-50"
                  >
                    {/* Salesperson */}
                    <td className="border-b border-gray-100 px-8 py-5">
                      <div className="flex items-center gap-4">

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-700 sm:h-12 sm:w-12 sm:text-lg">
                          {member.name.charAt(0)}
                        </div>

                        <div>
                          <h3 className="font-semibold text-gray-800">
                            {member.name}
                          </h3>

                          <p className="text-xs uppercase tracking-wide text-gray-400">
                            {member.role}
                          </p>
                        </div>

                      </div>
                    </td>

                    <td className="border-b border-gray-100 font-medium text-gray-700">
                      {member.leads}
                    </td>

                    <td className="border-b border-gray-100 font-medium text-gray-700">
                      {member.meetings}
                    </td>

                    <td className="border-b border-gray-100 font-medium text-gray-700">
                      {member.proposals}
                    </td>

                    <td className="border-b border-gray-100 font-semibold text-gray-900">
                      {member.closed}
                    </td>

                    <td className="border-b border-gray-100 font-semibold text-gray-900">
                      {member.value}
                    </td>

                    <td className="border-b border-gray-100">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          member.status === "good"
                            ? "bg-green-50 text-green-600"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {member.conversion}
                      </span>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </main>
  );
}