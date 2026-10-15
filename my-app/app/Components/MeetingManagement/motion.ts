export const EASE = [0.2, 0.8, 0.2, 1] as const;

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#22C55E] focus-visible:ring-offset-2";

export function fadeUp(reduce: boolean | null, distance: number, delay = 0) {
  return {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: distance },
    animate: reduce ? { opacity: 1 } : { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: distance / 2 },
    transition: { duration: reduce ? 0.2 : 0.22, delay, ease: EASE },
  };
}

export function hoverLift(reduce: boolean | null, y = -1) {
  if (reduce) return { whileTap: { scale: 0.98 } };
  return {
    whileHover: { y },
    whileTap: { scale: 0.98 },
    transition: { duration: 0.18, ease: EASE },
  };
}
