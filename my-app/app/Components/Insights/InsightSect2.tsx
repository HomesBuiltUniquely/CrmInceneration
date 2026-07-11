export default function InsightSect2() {
  return (
    <main>
      <div
        className="mt-8 grid grid-cols-1 gap-4 px-4
            sm:grid-cols-2 sm:px-6
            lg:grid-cols-4
            sm:font-semibold tracking-wide
            md:font-bold
            lg:tracking-widest
            xl:tracking-widest
            2xl:tracking-widest"
      >
        {/* Total Leads */}
        <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 sm:text-sm">
                Total Leads
              </p>
              <span className="text-2xl align-baseline font-bold text-gray-900 sm:text-3xl">
                1,284
              </span>
            </div>

            <h2 className="mt-2 inline-block whitespace-nowrap rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-600 sm:text-sm">
              +12.5%
            </h2>
          </div>

          <div className="mt-8 h-1.5 rounded-full bg-gray-200">
            <div className="h-1.5 w-4/5 rounded-full bg-green-500"></div>
          </div>
        </div>

        {/* Pipeline Value */}
        <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 sm:text-sm">
                Pipeline Value
              </p>
              <span className="text-2xl align-baseline font-bold text-gray-900 sm:text-3xl">
                ₹84.2M
              </span>
            </div>

            <h2 className="mt-2 inline-block whitespace-nowrap rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-600 sm:text-sm">
              +₹2.4M
            </h2>
          </div>

          <div className="mt-8 h-1.5 rounded-full bg-gray-200">
            <div className="h-1.5 w-11/12 rounded-full bg-green-500"></div>
          </div>
        </div>

        {/* Closed Won */}
        <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 sm:text-sm">
                Closed Won
              </p>
              <span className="text-2xl align-baseline font-bold text-gray-900 sm:text-3xl">
                ₹12.8M
              </span>
            </div>

            <h2 className="mt-2 inline-block whitespace-nowrap rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600 sm:text-sm">
              -3.1%
            </h2>
          </div>

          <div className="mt-8 h-1.5 rounded-full bg-gray-200">
            <div className="h-1.5 w-2/5 rounded-full bg-green-500"></div>
          </div>
        </div>

        {/* Conversion % */}
        <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 sm:text-sm">
                Conversion %
              </p>
              <span className="text-2xl align-baseline font-bold text-gray-900 sm:text-3xl">
                18.4%
              </span>
            </div>

            <h2 className="mt-2 inline-block whitespace-nowrap rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-600 sm:text-sm">
              +0.8%
            </h2>
          </div>

          <div className="mt-8 h-1.5 rounded-full bg-gray-200">
            <div className="h-1.5 w-1/4 rounded-full bg-green-500"></div>
          </div>
        </div>
      </div>
    </main>
  );
}
