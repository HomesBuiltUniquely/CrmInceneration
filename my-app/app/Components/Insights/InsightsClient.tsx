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
