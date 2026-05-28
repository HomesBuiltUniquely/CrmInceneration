"use client";

import { URGENT_TASKS } from "../data/mock-data";

export default function UrgentTasks() {
  return (
    <section className="rounded-xl border border-[var(--bt-border)] bg-[var(--bt-surface)] p-5 shadow-sm">
      <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--bt-muted)]">
        Urgent Token Ledger Tasks
      </h2>
      <ul className="mt-4 space-y-3">
        {URGENT_TASKS.map((task) => {
          const isDanger = task.tone === "danger";
          return (
            <li
              key={task.id}
              className={`flex items-start gap-3 rounded-lg border-l-4 p-4 ${
                isDanger
                  ? "border-l-red-500 bg-[var(--bt-red-soft)]"
                  : "border-l-orange-400 bg-[var(--bt-orange-soft)]"
              }`}
            >
              <span className={`text-lg ${isDanger ? "text-red-500" : "text-orange-500"}`} aria-hidden>
                {isDanger ? "!" : "🔔"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--bt-text)]">{task.title}</p>
                <p className="text-xs text-[var(--bt-muted)]">{task.detail}</p>
              </div>
              <span
                className={`shrink-0 text-[10px] font-bold uppercase ${
                  isDanger ? "text-red-600" : "text-orange-600"
                }`}
              >
                {task.due}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
