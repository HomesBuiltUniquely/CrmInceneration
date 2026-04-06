function Pill({
  label,
  value,
  active,
}: {
  label: string;
  value?: number | string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold ${
        active
          ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
          : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span>{label}</span>
      {value !== undefined ? (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}
        >
          {value}
        </span>
      ) : null}
    </button>
  );
}

function SmallButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
    >
      {label}
    </button>
  );
}

function DensityToggle() {
  return (
    <div className="flex items-center rounded-xl bg-white p-1 ring-1 ring-slate-200">
      <button type="button" className="rounded-lg bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
        Comfortable
      </button>
      <button type="button" className="rounded-lg px-3 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50">
        Compact
      </button>
    </div>
  );
}

type LeadsToolbarProps = {
  totalCount?: number;
  rangeStart?: number;
  rangeEnd?: number;
  loading?: boolean;
};

export default function LeadsToolbar({
  totalCount,
  rangeStart,
  rangeEnd,
  loading,
}: LeadsToolbarProps) {
  const countLabel =
    loading || totalCount === undefined ? "—" : totalCount.toLocaleString();
  const rangeLabel =
    loading || rangeStart === undefined || rangeEnd === undefined
      ? "—"
      : `${rangeStart}-${rangeEnd}`;

  return (
    <section className="mx-auto mt-4 max-w-[1200px] px-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill label="All Leads" value={countLabel} active />
            <Pill label="Stale Only" />
            <Pill label="High Value" />
            <Pill label="Needs Intervention" />
            <Pill label="Recent Activity" />
          </div>

          <div className="flex items-center gap-3">
            <DensityToggle />
            <div className="text-right text-[11px] font-semibold text-slate-500">
              <div>{rangeLabel} of</div>
              <div>{countLabel}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SmallButton label="Filter" />
          <SmallButton label="Sort" />
        </div>
      </div>
    </section>
  );
}
