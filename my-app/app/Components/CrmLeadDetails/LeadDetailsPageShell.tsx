"use client";

import type { ReactNode } from "react";

export default function LeadDetailsPageShell({
  topBar,
  hero,
  designQaPanel,
  sidebar,
  phases,
  footer,
  errors,
}: {
  topBar: ReactNode;
  hero: ReactNode;
  designQaPanel?: ReactNode;
  sidebar: ReactNode;
  phases: ReactNode;
  footer?: ReactNode;
  errors?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f4f6f8] px-4 py-5 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px]">
        {topBar}
        {hero}
        {designQaPanel}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-4">{sidebar}</div>
          <div className="min-w-0 space-y-4">{phases}</div>
        </div>
        {errors}
        {footer}
      </div>
    </main>
  );
}
