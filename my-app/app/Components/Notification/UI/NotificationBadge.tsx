"use client";

import { cn } from "@/lib/cn";

type Props = {
  count: number;
  className?: string;
};

/**
 * Red circle badge positioned on the RIGHT side of the bell,
 * vertically at the upper-right of the bell body — exactly like the reference image.
 * Rendered as a sibling of the button (outside it) so it is never clipped.
 */
export default function NotificationBadge({ count, className }: Props) {
  if (count <= 0) return null;

  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      aria-label={`${count} unread notification${count !== 1 ? "s" : ""}`}
      className={cn(
        // right-0 puts it flush with the right edge of the wrapper
        // top-1 puts it at ~25% from top — upper-right of the bell body
        "pointer-events-none absolute -right-3 top-0 z-10 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white shadow-md",
        className,
      )}
    >
      {label}
    </span>
  );
}
