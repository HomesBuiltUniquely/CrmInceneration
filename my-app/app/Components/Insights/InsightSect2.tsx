export default function InsightSect2() {
  return (
    <main>
      <div
        className="mt-8 flex gap-4
       justify-between items-center 
            sm:font-semibold tracking-wide text-indigo-500 
            md:font-bold text-lg md:text-2xl lg:text-2xl m-4
            lg:tracking-widest 
            xl:tracking-widest
            2xl:tracking-widest"
      >
        <div className="w-64 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-gray-400">
                Total Leads
              </p>
              <span className="text-3xl align-baseline font-bold text-gray-900">
                1,248
              </span>
            </div>

            <h2 className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-600">
              +12.5%
            </h2>
          </div>

          <div className="mt-8 h-1.5 rounded-full bg-gray-200">
            <div className="h-1.5 w-4/5 rounded-full bg-green-500"></div>
          </div>
        </div>
        <div className="w-64 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-gray-400">
                Pipeline Value
              </p>
              <span className="text-3xl align-baseline font-bold text-gray-900">
                $2.4M
              </span>
            </div>
            <h2 className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-600">
              +8.2%
            </h2>
            <div className="mt-8 h-1.5 rounded-full bg-gray-200">
              <div className="h-1.5 w-4/5 rounded-full bg-green-500"></div>
            </div>
          </div>
        </div>
        <div className="w-64 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-gray-400">
                Closed Won
              </p>
              <span className="text-3xl align-baseline font-bold text-gray-900">
                $1.8M
              </span>
            </div>
            <h2 className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-600">
              +15.3%
            </h2>
            <div className="mt-8 h-1.5 rounded-full bg-gray-200">
              <div className="h-1.5 w-4/5 rounded-full bg-green-500"></div>
            </div>
          </div>
        </div>
        <div className="w-64 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-gray-400">
                Conversion %
              </p>
              <span className="text-3xl align-baseline font-bold text-gray-900">
                24.8%
              </span>
            </div>
            <h2 className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-600">
              +5.7%
            </h2>
            <div className="mt-8 h-1.5 rounded-full bg-gray-200">
              <div className="h-1.5 w-4/5 rounded-full bg-green-500"></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
