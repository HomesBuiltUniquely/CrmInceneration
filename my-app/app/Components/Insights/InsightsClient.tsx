export default function InsightsClient1() {
  return (
    <main className="w-full bg-[#f4f7fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        {/* Left */}
        <div className="shrink-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1f2937] sm:text-4xl">
            CRM Insights
          </h1>

          <p className="mt-2 max-w-md text-sm text-gray-500 sm:text-base">
            Precision analytics for elite interior design operations.
          </p>
        </div>

        {/* Right */}
        <div className="w-full lg:w-auto">
          {/* Mobile & Small Tablets */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            <select className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm">
              <option>Last 30 Days</option>
            </select>

            <select className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm">
              <option>All Salespeople</option>
            </select>

            <select className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm">
              <option>Location: All</option>
            </select>

            <button className="h-10 rounded-md bg-[#111827] text-sm font-semibold text-white hover:bg-[#1f2937]">
              Export PDF
            </button>
          </div>
          {/* Desktop */}
          <div className="hidden lg:block">
            <div className="flex gap-3">
              <select className="h-10 w-40 rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option>Last 30 Days</option>
              </select>

              <select className="h-10 w-40 rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option>All Salespeople</option>
              </select>

              <select className="h-10 w-36 rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option>Location: All</option>
              </select>
            </div>

            <button className="mt-3 flex h-10 w-40 items-center justify-center rounded-md bg-[#111827] text-sm font-semibold text-white hover:bg-[#1f2937]">
              Export PDF
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
