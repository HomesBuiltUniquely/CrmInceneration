export default function InsightSect3() {
  return (
    <main className="mt-10 px-4">
      <div className="mx-auto flex max-w-[1300px] flex-col gap-8 lg:flex-row">
        <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:w-[68%]">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-xl font-bold">Sales Funnel Efficiency</h2>
            <div className="flex h-6 w-6 items-center justify-center rounded-full border text-gray-400">
              i
            </div>
          </div>
          <div className="space-y-6">
            <div className="flex w-full items-center">
              <div className="flex h-14 w-[86%] items-center justify-between gap-3 bg-[#111827] px-3 text-white sm:px-5">
                <span className="text-xs sm:text-sm lg:text-base">
                  Discovery
                </span>
                <span className="text-xs font-bold sm:text-sm lg:text-base">
                  1,284 Leads | ₹240M
                </span>
              </div>
              <span className="ml-auto pl-3 text-xs sm:text-sm">100%</span>
            </div>
            <div className="flex w-full items-center">
              <div className="ml-2 flex h-14 w-[78%] items-center justify-between gap-3 bg-[#233044] px-3 text-white sm:ml-5 sm:px-5 lg:ml-8">
                <span className="text-xs sm:text-sm lg:text-base">
                  Connection
                </span>
                <span className="text-xs font-bold sm:text-sm lg:text-base">
                  842 Leads | ₹180M
                </span>
              </div>
              <span className="ml-auto pl-3 text-xs sm:text-sm">65.6%</span>
            </div>
            <div className="flex w-full items-center">
              <div className="ml-4 flex h-14 w-[70%] items-center justify-between gap-3 bg-[#41516A] px-3 text-white sm:ml-9 sm:px-5 lg:ml-14">
                <span className="text-xs sm:text-sm lg:text-base">
                  Exp &amp; Design
                </span>
                <span className="text-xs font-bold sm:text-sm lg:text-base">
                  412 Leads | ₹110M
                </span>
              </div>
              <span className="ml-auto pl-3 text-xs sm:text-sm">48.9%</span>
            </div>
            <div className="flex w-full items-center">
              <div className="ml-6 flex h-14 w-[62%] items-center justify-between gap-3 bg-[#59677D] px-3 text-white sm:ml-12 sm:px-5 lg:ml-20">
                <span className="text-xs sm:text-sm lg:text-base">
                  Decision
                </span>
                <span className="text-xs font-bold sm:text-sm lg:text-base">
                  186 Leads | ₹45M
                </span>
              </div>
              <span className="ml-auto pl-3 text-xs sm:text-sm">45.1%</span>
            </div>
            <div className="flex w-full items-center">
              <div className="ml-8 flex h-14 w-[54%] items-center justify-between gap-3 bg-[#22E574] px-3 sm:ml-16 sm:px-5 lg:ml-28">
                <span className="text-xs sm:text-sm lg:text-base">
                  Closed Won
                </span>
                <span className="text-xs font-bold sm:text-sm lg:text-base">
                  94 Deals | ₹12.8M
                </span>
              </div>
              <span className="ml-auto pl-3 text-xs sm:text-sm">50.5%</span>
            </div>
          </div>
        </div>
        <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:w-[32%]">
          <h2 className="mb-8 text-xl font-bold">Revenue Distribution</h2>
          <div className="space-y-7">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>DESIGN PHASE</span>
                <span>₹38.4M (45%)</span>
              </div>
              <div className="h-4 bg-gray-200">
                <div className="h-4 w-[45%] bg-[#111827]"></div>
              </div>
            </div>
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>QUOTATION</span>
                <span>₹22.1M (26%)</span>
              </div>
              <div className="h-4 bg-gray-200">
                <div className="h-4 w-[26%] bg-[#334155]"></div>
              </div>
            </div>
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>FABRICATION</span>
                <span>₹15.3M (18%)</span>
              </div>
              <div className="h-4 bg-gray-200">
                <div className="h-4 w-[18%] bg-[#64748B]"></div>
              </div>
            </div>
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>INSTALLATION</span>
                <span>₹8.4M (11%)</span>
              </div>
              <div className="h-4 bg-gray-200">
                <div className="h-4 w-[11%] bg-[#22E574]"></div>
              </div>
            </div>
          </div>
          <div className="mt-8 border-l-4 border-[#22E574] bg-green-50 p-4">
            <p className="text-sm italic text-gray-500">
              "Concentration is high in Design Phase. Fabrication timelines are
              currently the primary bottleneck for revenue realization."
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
