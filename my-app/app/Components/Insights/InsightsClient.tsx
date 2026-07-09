export default function InsightsClient1() {
  return (
    <main>
      <div
        className="flex justify-between items-center 
            sm:font-semibold tracking-wide text-indigo-500 
            md:text-2xl lg:text-2xl m-4
            lg:tracking-widest 
            xl:tracking-widest
            2xl:tracking-widest"
      >
        <div className="m-4">
          <h1 className="text-3xl font-bold"> CRM Insights</h1>
          <div className="text-lg font-medium pt-2 text-amber-100">
            Precision analytics for elite interior design operations.
          </div>
        </div>
        <div className="flex justify-between gap-4 m-4">
          <div> Last 30 Days</div>
          <div> All Salespeople </div>
          <div>Location All</div>
          <div className="flex justify-end">
            <button className="flex bg-white-600 hover:bg-white-900 text-black font-bold py-30 px-4 rounded">
              Export PDF
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export function InsightsClient2() {
  return (
    <main>
      <div className="flex flex-col gap-4 rounded-xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-indigo-700">CRM Insights</h1>
          <p className="pt-2 text-base text-slate-600">
            Real-time reporting for high-performing design teams.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-white px-3 py-2 text-sm text-slate-700">
            Last 30 Days
          </span>
          <span className="rounded-full bg-white px-3 py-2 text-sm text-slate-700">
            All Salespeople
          </span>
          <span className="rounded-full bg-white px-3 py-2 text-sm text-slate-700">
            Location All
          </span>
          <button className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700">
            Export PDF
          </button>
        </div>
      </div>
    </main>
  );
}

export function InsightsClient3() {
  return (
    <main>
      <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-6 text-white shadow-lg">
        <div>
          <h1 className="text-3xl font-bold">CRM Insights</h1>
          <p className="pt-2 text-sm text-slate-300">
            Streamlined analytics for modern interior design operations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded border border-slate-700 px-3 py-2 text-sm">Last 30 Days</div>
          <div className="rounded border border-slate-700 px-3 py-2 text-sm">All Salespeople</div>
          <div className="rounded border border-slate-700 px-3 py-2 text-sm">Location All</div>
          <button className="rounded bg-amber-400 px-4 py-2 font-semibold text-slate-900 hover:bg-amber-500">
            Export PDF
          </button>
        </div>
      </div>
    </main>
  );
}
