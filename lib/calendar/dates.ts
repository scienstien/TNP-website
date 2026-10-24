/** Calendar date helpers. Dates are plain "YYYY-MM-DD" strings (no time zone shifts). */

const TIME_ZONE = "Asia/Kolkata"; // the institute's time zone

/** Today's date at the institute, as YYYY-MM-DD. */
export function todayInInstituteZone(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

/** True for a real calendar date written as YYYY-MM-DD (rejects 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function toIsoDate(
  year: number,
  monthIndex: number,
  day: number,
): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const utcMillis = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** The date `days` days after `isoDate` (negative goes back), as YYYY-MM-DD. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(utcMillis(isoDate) + days * 86_400_000);
  return toIsoDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** "24 Oct" style label for a YYYY-MM-DD date. */
export function shortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcMillis(to) - utcMillis(from)) / 86_400_000);
}

export type VisitStatus = "Today" | "Upcoming" | "Completed";

/** Status is derived from the date, never stored. */
export function visitStatus(visitDate: string, today: string): VisitStatus {
  const diff = daysBetween(today, visitDate);
  return diff === 0 ? "Today" : diff > 0 ? "Upcoming" : "Completed";
}

export function relativeLabel(visitDate: string, today: string): string {
  const diff = daysBetween(today, visitDate);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1) return `In ${diff} days`;
  return diff === -1 ? "Yesterday" : `${-diff} days ago`;
}
