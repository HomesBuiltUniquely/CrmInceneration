export default function InsightSect3() {
  return (
    <main>
      {/* Sales Funnel & Revenue Distribution */}
      <div
        className="mt-10 flex justify-center 
      sm:font-semibold tracking-wide text-indigo-500 
            md:text-2xl lg:text-2xl m-4
            lg:tracking-widest 
            xl:tracking-widest
            2xl:tracking-widest"
      >
        <div className="flex gap-10">
          {/* Sales Funnel Card */}
          <div className="w-225 min-h-140 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-bold text-gray-900">
              Sales Funnel Efficiency
            </h2>
          </div>

          {/* Revenue Distribution Card */}
          <div className="w-105 min-h-140 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-bold text-gray-900">
              Revenue Distribution
            </h2>
          </div>
        </div>
      </div>
    </main>
  );
}
