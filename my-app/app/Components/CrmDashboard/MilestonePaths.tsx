type PathItem = {
  title: string;
  subtitle?: string;
  value: number | string;
  tone?: "neutral" | "success" | "danger";
  leftAccent?: "success" | "warning" | "danger" | "neutral";
};

function formatCompact(n: number) {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${n}`;
}

function AccentBar({ kind }: { kind: NonNullable<PathItem["leftAccent"]> }) {
  const cls =
    kind === "success"
      ? "bg-emerald-400"
      : kind === "warning"
        ? "bg-amber-400"
        : kind === "danger"
          ? "bg-rose-400"
          : "bg-slate-200";
  return <div className={`h-10 w-1.5 rounded-full ${cls}`} />;
}

function StatCard({ item }: { item: PathItem }) {
  const toneCls =
    item.tone === "success"
      ? "bg-emerald-50 border-emerald-100"
      : item.tone === "danger"
        ? "bg-rose-50 border-rose-100"
        : "bg-white border-slate-200";

  return (
    <div
      className={`flex items-center justify-between rounded-2xl border px-5 py-4 shadow-sm ${toneCls} `}
    >
      <div className="flex items-center gap-4">
        <AccentBar kind={item.leftAccent ?? "neutral"} />
        <div className="leading-tight">
          <div className="text-[12px] font-semibold tracking-wide text-slate-600">
            {item.title}
          </div>
          {item.subtitle ? (
            <div className="mt-1 text-[11px] font-medium text-slate-400">
              {item.subtitle}
            </div>
          ) : null}
        </div>
      </div>
      <div className="text-[16px] font-semibold text-slate-700">
        {item.value}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  total,
  underline,
}: {
  title: string;
  total: number;
  underline: "success" | "danger";
}) {
  const underlineCls =
    underline === "success" ? "bg-emerald-400" : "bg-rose-400";
  const totalCls =
    underline === "success" ? "text-emerald-500" : "text-rose-500";
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-end gap-3">
        <div className="text-[14px] font-semibold text-slate-700">{title}</div>
        <div className={`text-[12px] font-semibold ${totalCls}`}>
          {formatCompact(total)} Leads
        </div>
      </div>
      <div className={`h-1 w-40 rounded-full ${underlineCls}`} />
    </div>
  );
}

function CompassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 text-blue-600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M14.9 9.1 13 13l-3.9 1.9L11 11l3.9-1.9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 7.25v.75M12 16v.75M7.25 12H8M16 12h.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function MilestonePaths() {
  const discoveryTotal = 1240;
  const wonTotal = 1080;
  const lostTotal = 160;

  const wonItems: PathItem[] = [
    {
      title: "FRESH LEAD",
      subtitle: "Avg. Response: 2h",
      value: 400,
      leftAccent: "neutral",
    },
    {
      title: "ATTEMPTING CONNECT",
      subtitle: "SLA Alert: 2d – Dwell",
      value: 350,
      leftAccent: "warning",
    },
    {
      title: "CALL SCHEDULED",
      subtitle: "85% · Show Rate",
      value: 200,
      leftAccent: "neutral",
    },
    {
      title: "QUALIFIED",
      subtitle: "Ready for Qualification Phase",
      value: 130,
      tone: "success",
      leftAccent: "success",
    },
  ];

  const lostItems: PathItem[] = [
    {
      title: "INVALID LEAD",
      subtitle: "Missing Contact Info",
      value: 50,
      leftAccent: "danger",
    },
    {
      title: "NOT INTERESTED",
      subtitle: "Competitor Selected",
      value: 80,
      leftAccent: "neutral",
    },
    {
      title: "WRONG PERSONA",
      subtitle: "ICP Mismatch",
      value: 30,
      leftAccent: "neutral",
    },
  ];

  return (
    <section className="xl:ml-6 xl:mt-10 xl:w-263.75">
      <div className="flex gap-6">
        {/* Left: Discovery summary */}
        <div className="w-64 rounded-3xl bg-[#F5F7FF] px-7 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
              <CompassIcon />
            </div>
            <div>
              <div className="text-[18px] font-semibold text-slate-700">
                Discovery
              </div>
              <div className="mt-0.5 text-[12px] font-medium text-slate-400">
                Initial Engagement Phase
              </div>
            </div>
          </div>

          <div className="mt-7 rounded-2xl bg-white px-6 py-6 shadow-sm">
            <div className="text-[32px] font-semibold tracking-tight text-slate-800">
              {discoveryTotal.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] font-semibold tracking-wide text-slate-400">
              TOTAL ACTIVE LEADS
            </div>
          </div>
        </div>

        {/* Right: Won/Lost paths */}
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <SectionHeader
                title="Won Path"
                total={wonTotal}
                underline="success"
              />
              <div className="mt-4 flex flex-col gap-3">
                {wonItems.map((item) => (
                  <StatCard key={item.title} item={item} />
                ))}
              </div>
            </div>

            <div>
              <SectionHeader
                title="Lost Path"
                total={lostTotal}
                underline="danger"
              />
              <div className="mt-4 flex flex-col gap-3">
                {lostItems.map((item) => (
                  <StatCard key={item.title} item={item} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
