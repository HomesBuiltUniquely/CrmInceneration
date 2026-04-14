import type { MilestonePathItem } from "@/types/crm-pipeline";

function formatCompact(n: number) {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${n}`;
}

function AccentBar({
  kind,
}: {
  kind: NonNullable<MilestonePathItem["leftAccent"]>;
}) {
  const cls =
    kind === "success"
      ? "bg-[var(--crm-success)]"
      : kind === "warning"
        ? "bg-[var(--crm-warning-text)]"
        : kind === "danger"
          ? "bg-[var(--crm-danger)]"
          : "bg-[var(--crm-border)]";
  return <div className={`h-10 w-1.5 rounded-full ${cls}`} />;
}

function StatCard({ item }: { item: MilestonePathItem }) {
  const toneCls =
    item.tone === "success"
      ? "bg-[var(--crm-success-bg)] border-[var(--crm-success)]"
      : item.tone === "danger"
        ? "bg-[var(--crm-danger-bg)] border-[var(--crm-danger)]"
        : "bg-[var(--crm-surface)] border-[var(--crm-border)]";

  return (
    <div
      className={`flex items-center justify-between rounded-2xl border px-5 py-4 shadow-sm ${toneCls} `}
    >
      <div className="flex items-center gap-4">
        <AccentBar kind={item.leftAccent ?? "neutral"} />
        <div className="leading-tight">
          <div className="text-[12px] font-semibold tracking-wide text-[var(--crm-text-secondary)]">
            {item.title}
          </div>
          {item.subtitle ? (
            <div className="mt-1 text-[11px] font-medium text-[var(--crm-text-muted)]">
              {item.subtitle}
            </div>
          ) : null}
        </div>
      </div>
      <div className="text-[16px] font-semibold text-[var(--crm-text-primary)]">
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
    underline === "success" ? "bg-[var(--crm-success)]" : "bg-[var(--crm-danger)]";
  const totalCls =
    underline === "success" ? "text-[var(--crm-success-text)]" : "text-[var(--crm-danger-text)]";
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-end gap-3">
        <div className="text-[14px] font-semibold text-[var(--crm-text-primary)]">{title}</div>
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
      className="h-5 w-5 text-[var(--crm-accent)]"
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

type Props = {
  stageTitle: string;
  stageSubtitle: string;
  totalActiveLeads: number;
  wonTotal: number;
  lostTotal: number;
  wonItems: MilestonePathItem[];
  lostItems: MilestonePathItem[];
};

export default function MilestonePaths({
  stageTitle,
  stageSubtitle,
  totalActiveLeads,
  wonTotal,
  lostTotal,
  wonItems,
  lostItems,
}: Props) {
  return (
    <section className="xl:ml-6 xl:mt-10 xl:w-263.75">
      <div className="flex gap-6">
        <div className="w-64 rounded-3xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-7 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--crm-surface)] shadow-[var(--crm-shadow-sm)]">
              <CompassIcon />
            </div>
            <div>
              <div className="text-[18px] font-semibold capitalize text-[var(--crm-text-primary)]">
                {stageTitle}
              </div>
              <div className="mt-0.5 text-[12px] font-medium text-[var(--crm-text-muted)]">
                {stageSubtitle}
              </div>
            </div>
          </div>

          <div className="mt-7 rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] px-6 py-6 shadow-[var(--crm-shadow-sm)]">
            <div className="text-[32px] font-semibold tracking-tight text-[var(--crm-text-primary)]">
              {totalActiveLeads.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] font-semibold tracking-wide text-[var(--crm-text-muted)]">
              TOTAL ACTIVE LEADS
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <SectionHeader
                title="Won Path"
                total={wonTotal}
                underline="success"
              />
              <div className="mt-4 flex flex-col gap-3">
                {wonItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--crm-border)] px-5 py-6 text-center text-sm text-[var(--crm-text-muted)]">
                    No won substages for this stage.
                  </div>
                ) : (
                  wonItems.map((item) => (
                    <StatCard key={item.title} item={item} />
                  ))
                )}
              </div>
            </div>

            <div>
              <SectionHeader
                title="Lost Path"
                total={lostTotal}
                underline="danger"
              />
              <div className="mt-4 flex flex-col gap-3">
                {lostItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--crm-border)] px-5 py-6 text-center text-sm text-[var(--crm-text-muted)]">
                    No lost substages for this stage.
                  </div>
                ) : (
                  lostItems.map((item) => (
                    <StatCard key={item.title} item={item} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
