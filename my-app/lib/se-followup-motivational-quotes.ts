/** Four weeks × seven days — repeats on a 4-week cycle (local calendar). */
const WEEKS: readonly (readonly string[])[] = [
  [
    "Every call brings you closer.",
    "Consistency beats intensity — show up for your list.",
    "Your pipeline grows one conversation at a time.",
    "Today's follow-ups are tomorrow's wins.",
    "Listen first; the close follows trust.",
    "Small actions compound into big quarters.",
    "Focus on the next lead, not the whole mountain.",
  ],
  [
    "Discipline today saves firefighting tomorrow.",
    "A clear follow-up is a gift to your future self.",
    "Energy flows where attention goes — start with priority.",
    "Reps are built in the routine, not the rush.",
    "Respect the customer's time; earn the next minute.",
    "Progress over perfection on every dial.",
    "You don't need more leads — you need more finished follow-ups.",
  ],
  [
    "Momentum starts with the first call of the day.",
    "Show up prepared; leave them valued.",
    "Overdue cleared today is stress removed tonight.",
    "Curiosity opens doors pressure cannot.",
    "Your calendar is a promise — keep it.",
    "Win the morning list; win the day.",
    "Excellence is repeated follow-through.",
  ],
  [
    "Trust is stored in kept commitments.",
    "One honest conversation beats ten vague ones.",
    "Finish strong — your evening self will thank you.",
    "Leaders are made in the daily grind.",
    "Clarity in the CRM creates clarity on the call.",
    "Stay calm; stay persistent.",
    "Today's effort is next month's revenue.",
  ],
] as const;

/** ISO-ish local date key `YYYY-MM-DD`. */
export function localCalendarDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Day index 0 (Sun) … 6 (Sat). */
export function localDayOfWeek(now = new Date()): number {
  return now.getDay();
}

/** Repeat every 4 weeks from a fixed anchor (local year start). */
export function motivationalWeekIndex(now = new Date()): number {
  const start = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const weekOfYear = Math.floor(dayOfYear / 7);
  return ((weekOfYear % 4) + 4) % 4;
}

export function quoteForLocalDate(now = new Date()): string {
  const week = WEEKS[motivationalWeekIndex(now)] ?? WEEKS[0];
  const day = localDayOfWeek(now);
  return week[day] ?? week[0] ?? WEEKS[0][0];
}