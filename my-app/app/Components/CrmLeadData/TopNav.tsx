import Image from "next/image";
import LogoutButton from "../LogoutButton";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M16.2 16.2 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function TopNav() {
  return (
    <div className="w-full border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
              <Image src="/HowsCrmLogo.png" alt="Nexus CRM" width={24} height={24} />
            </div>
            <div className="text-[15px] font-semibold text-slate-800">Hows CRM</div>
          </div>

          <div className="flex items-center gap-2 text-[12px] font-medium text-slate-400">
            <span className="text-slate-400">Dashboard</span>
            <span className="px-2 text-slate-300">/</span>
            <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-600">Lead Management</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LogoutButton className="border border-slate-200 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50" />
          <div className="flex w-[340px] items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
            <SearchIcon />
            <input
              className="w-full bg-transparent text-[12px] font-medium text-slate-600 placeholder:text-slate-400 focus:outline-none"
              placeholder="Search leads, tasks, owners..."
            />
          </div>
          <button className="rounded-xl bg-blue-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-blue-700">
            + Add New Lead
          </button>
        </div>
      </div>
    </div>
  );
}

