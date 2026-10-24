/**
 * "Students placed over time": final offers counted by offer date (placement_offers.offer_date),
 * bucketed by year, month and ISO week. Pure functions over the dashboard's PlacementRecord[];
 * the records are already limited to the authorized department. Only REGISTERED participation
 * counts (same population as the other analytics). Offers with no valid date are reported, not
 * guessed, and offers dated after today are held back so the "current period" is never ahead of
 * the calendar. Missing periods are zero-filled so lines and columns never skip.
 */
import { addDays, daysBetween, isValidIsoDate, toIsoDate } from "@/lib/calendar/dates";
import type { PlacementRecord } from "./types";

export type TimeView = "year" | "month" | "week" | "day";
export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
/** Weeks shown in the Week view (the most recent). */
export const WEEK_WINDOW = 52;
export const MOVING_AVERAGE_WEEKS = 4;
/** Days shown in the Day view (the most recent) and the length of its moving average. */
export const DAY_WINDOW = 30;
export const MOVING_AVERAGE_DAYS = 7;

export interface OfferDates {
  /** YYYY-MM-DD of each counted offer (on or before today). */
  dates: string[];
  /** Registered offers with no usable offer date. */
  undated: number;
  /** Registered offers dated after today. */
  future: number;
}

export function offerDates(records: PlacementRecord[], today: string): OfferDates {
  const result: OfferDates = { dates: [], undated: 0, future: 0 };
  for (const record of records) {
    if (record.registrationStatus !== "REGISTERED" || !record.offer) continue;
    const date = record.offer.offerDate;
    if (!date || !isValidIsoDate(date)) result.undated += 1;
    else if (date > today) result.future += 1;
    else result.dates.push(date);
  }
  return result;
}

/** ISO 8601 week of a YYYY-MM-DD date: weeks start on Monday and week 1 holds the year's first Thursday. */
export function isoWeek(date: string): { isoYear: number; week: number } {
  const [y, m, d] = date.split("-").map(Number);
  const day = Date.UTC(y, m - 1, d);
  const mondayIndex = (new Date(day).getUTCDay() + 6) % 7;
  const thursday = day - mondayIndex * 86_400_000 + 3 * 86_400_000;
  const isoYear = new Date(thursday).getUTCFullYear();
  const jan4 = Date.UTC(isoYear, 0, 4);
  const week1Thursday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * 86_400_000 + 3 * 86_400_000;
  return { isoYear, week: 1 + Math.round((thursday - week1Thursday) / (7 * 86_400_000)) };
}

/** The Monday of the date's ISO week. */
export const weekStart = (date: string): string => {
  const [y, m, d] = date.split("-").map(Number);
  return addDays(date, -((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7));
};

/** Trailing average over `window` values; null until a full window is available. */
export function trailingAverage(values: number[], window = MOVING_AVERAGE_WEEKS): (number | null)[] {
  return values.map((_, index) => {
    if (index < window - 1) return null;
    let sum = 0;
    for (let i = index - window + 1; i <= index; i += 1) sum += values[i];
    return sum / window;
  });
}

export interface YearPoint { year: number; label: string; count: number; current: boolean }
export interface MonthPoint {
  month: number;
  label: string;
  /** Null for months that have not started yet, so the line stops at today. */
  current: number | null;
  previous: number;
}
export interface WeekPoint {
  /** Monday of the week, YYYY-MM-DD (also the stable key). */
  weekStart: string;
  isoYear: number;
  week: number;
  label: string;
  count: number;
  average: number | null;
  current: boolean;
}
export interface DayPoint {
  /** YYYY-MM-DD, also the stable key. */
  date: string;
  /** "24 Oct". */
  label: string;
  count: number;
  /** Trailing 7-day average, using the days just before the window so the first points are filled. */
  average: number;
  current: boolean;
}
export interface TimeKpi {
  /** The current period's name, e.g. "2026", "Oct 2026" or "W43 · 19 Oct". */
  periodLabel: string;
  total: number;
  previousLabel: string;
  previousTotal: number;
  /** Null when the previous period had no students, since a percentage of zero is undefined. */
  changePct: number | null;
  peak: { label: string; count: number } | null;
}
export interface TimeSeries {
  today: string;
  years: YearPoint[];
  months: MonthPoint[];
  currentYear: number;
  previousYear: number;
  weeks: WeekPoint[];
  days: DayPoint[];
  kpis: Record<TimeView, TimeKpi>;
  /** Offers counted across all views' underlying data. */
  counted: number;
}

const percentChange = (total: number, previous: number) => (previous === 0 ? null : ((total - previous) / previous) * 100);
const countBy = (items: string[], key: (item: string) => string) => {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
};
const shortDay = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const peakOf = <T,>(items: T[], count: (item: T) => number, label: (item: T) => string) => {
  let best: T | null = null;
  for (const item of items) if (best === null || count(item) > count(best)) best = item;
  return best !== null && count(best) > 0 ? { label: label(best), count: count(best) } : null;
};

/** Aggregates the offer dates once into every view, so switching the toggle only picks a series. */
export function buildTimeSeries(dates: string[], today: string): TimeSeries {
  const currentYear = Number(today.slice(0, 4));
  const previousYear = currentYear - 1;
  const currentMonth = Number(today.slice(5, 7));

  // Year: every year from the first dated offer to the current one.
  const byYear = countBy(dates, (date) => date.slice(0, 4));
  const firstYear = dates.length ? Math.min(...dates.map((date) => Number(date.slice(0, 4)))) : currentYear;
  const years: YearPoint[] = [];
  for (let year = Math.min(firstYear, currentYear); year <= currentYear; year += 1) {
    years.push({ year, label: String(year), count: byYear.get(String(year)) ?? 0, current: year === currentYear });
  }

  // Month: this year against last year, Jan to Dec.
  const byMonth = countBy(dates, (date) => date.slice(0, 7));
  const monthCount = (year: number, month: number) => byMonth.get(toIsoDate(year, month - 1, 1).slice(0, 7)) ?? 0;
  const months: MonthPoint[] = MONTH_LABELS.map((label, index) => ({
    month: index + 1,
    label,
    current: index + 1 <= currentMonth ? monthCount(currentYear, index + 1) : null,
    previous: monthCount(previousYear, index + 1),
  }));

  // Week: from the first dated offer's week to this week, then the last WEEK_WINDOW weeks.
  const thisWeek = weekStart(today);
  const byWeek = countBy(dates, weekStart);
  const firstWeek = dates.length ? dates.map(weekStart).reduce((a, b) => (a < b ? a : b)) : thisWeek;
  const span = Math.floor(daysBetween(firstWeek, thisWeek) / 7) + 1;
  const weekStarts = Array.from({ length: span }, (_, index) => addDays(firstWeek, index * 7));
  const counts = weekStarts.map((start) => byWeek.get(start) ?? 0);
  const averages = trailingAverage(counts);
  const weeks: WeekPoint[] = weekStarts.map((start, index) => {
    const { isoYear, week } = isoWeek(start);
    return { weekStart: start, isoYear, week, label: `W${week}`, count: counts[index], average: averages[index], current: start === thisWeek };
  }).slice(-WEEK_WINDOW);


  // Day: the last DAY_WINDOW days ending today; the days before the window feed the 7-day average.
  const byDay = countBy(dates, (date) => date);
  const dayCount = (date: string) => byDay.get(date) ?? 0;
  const lead = MOVING_AVERAGE_DAYS - 1;
  const dayDates = Array.from({ length: DAY_WINDOW + lead }, (_, index) => addDays(today, index - (DAY_WINDOW + lead - 1)));
  const dayAverages = trailingAverage(dayDates.map(dayCount), MOVING_AVERAGE_DAYS);
  const days: DayPoint[] = dayDates.map((date, index) => ({ date, label: shortDay(date), count: dayCount(date), average: dayAverages[index] ?? 0, current: date === today })).slice(lead);
  const yesterday = addDays(today, -1);
  const dayName = (date: string) => `${shortDay(date)} ${date.slice(0, 4)}`;
  const thisMonthKey = today.slice(0, 7);
  const lastMonth = currentMonth === 1 ? [previousYear, 12] : [currentYear, currentMonth - 1];
  const lastMonthKey = toIsoDate(lastMonth[0], lastMonth[1] - 1, 1).slice(0, 7);
  const lastWeek = addDays(thisWeek, -7);
  const monthName = (key: string) => `${MONTH_LABELS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  const weekName = (start: string) => `W${isoWeek(start).week} · ${shortDay(start)}`;

  const kpis: Record<TimeView, TimeKpi> = {
    year: {
      periodLabel: String(currentYear),
      total: byYear.get(String(currentYear)) ?? 0,
      previousLabel: String(previousYear),
      previousTotal: byYear.get(String(previousYear)) ?? 0,
      changePct: percentChange(byYear.get(String(currentYear)) ?? 0, byYear.get(String(previousYear)) ?? 0),
      peak: peakOf(years, (item) => item.count, (item) => item.label),
    },
    month: {
      periodLabel: monthName(thisMonthKey),
      total: byMonth.get(thisMonthKey) ?? 0,
      previousLabel: monthName(lastMonthKey),
      previousTotal: byMonth.get(lastMonthKey) ?? 0,
      changePct: percentChange(byMonth.get(thisMonthKey) ?? 0, byMonth.get(lastMonthKey) ?? 0),
      // Peak of the two plotted years, so it always matches what the chart shows.
      peak: peakOf(
        months.flatMap((point) => [{ label: `${point.label} ${previousYear}`, count: point.previous }, { label: `${point.label} ${currentYear}`, count: point.current ?? 0 }]),
        (item) => item.count, (item) => item.label),
    },
    week: {
      periodLabel: weekName(thisWeek),
      total: byWeek.get(thisWeek) ?? 0,
      previousLabel: weekName(lastWeek),
      previousTotal: byWeek.get(lastWeek) ?? 0,
      changePct: percentChange(byWeek.get(thisWeek) ?? 0, byWeek.get(lastWeek) ?? 0),
      peak: peakOf(weeks, (item) => item.count, (item) => weekName(item.weekStart)),
    },
    day: {
      periodLabel: dayName(today),
      total: dayCount(today),
      previousLabel: dayName(yesterday),
      previousTotal: dayCount(yesterday),
      changePct: percentChange(dayCount(today), dayCount(yesterday)),
      // Peak of the days shown, so it always matches the chart; ties go to the earliest day.
      peak: peakOf(days, (item) => item.count, (item) => dayName(item.date)),
    },
  };
  return { today, years, months, currentYear, previousYear, weeks, days, kpis, counted: dates.length };
}
