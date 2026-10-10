export function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
// Date-only inputs use UTC calendar arithmetic, avoiding local DST offsets.
// Month anniversaries clamp to the last day when the original day is absent.
export function diffBreakdown(from: Date, to: Date) {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  const totalMs = end - start;
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();
  const anniversary = (offset: number) => {
    const first = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + offset, 1));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(from.getUTCDate(), lastDay));
  };
  if (months >= 0 && anniversary(months) > end) months--;
  return { years: Math.floor(months / 12), months: ((months % 12) + 12) % 12, days: Math.floor((end - anniversary(months)) / 86400000), totalDays: totalMs / 86400000, totalHours: totalMs / 3600000, totalMins: totalMs / 60000, totalMs };
}
