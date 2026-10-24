import assert from "node:assert/strict";
import test from "node:test";
import { buildTimeSeries, DAY_WINDOW, isoWeek, offerDates, trailingAverage, weekStart, WEEK_WINDOW } from "./time-series";
import type { PlacementRecord } from "./types";

const record = (offerDate: string | null | undefined, registrationStatus: PlacementRecord["registrationStatus"] = "REGISTERED"): PlacementRecord => ({
  department: "civil", cycleId: "c", cycleCode: "26-27", cycleStartsOn: null, cycleEndsOn: null, registrationStatus,
  offer: offerDate === undefined ? null : { company: "Acme", domain: null, packageLpa: 10, offerType: "FTE", offerDate },
});

test("ISO weeks follow ISO 8601 around year boundaries", () => {
  assert.deepEqual(isoWeek("2026-01-01"), { isoYear: 2026, week: 1 });
  assert.deepEqual(isoWeek("2024-12-30"), { isoYear: 2025, week: 1 }, "a December Monday can belong to next year's week 1");
  assert.deepEqual(isoWeek("2021-01-03"), { isoYear: 2020, week: 53 }, "early January can belong to week 53");
  assert.deepEqual(isoWeek("2026-10-24"), { isoYear: 2026, week: 43 });
  assert.equal(weekStart("2026-10-24"), "2026-10-19", "Saturday maps to its Monday");
  assert.equal(weekStart("2026-10-19"), "2026-10-19");
  assert.equal(weekStart("2026-10-25"), "2026-10-19", "Sunday still belongs to the week that started Monday");
});

test("only registered, valid, not-future offer dates are counted; the rest are reported", () => {
  const today = "2026-10-24";
  const result = offerDates([
    record("2026-10-01"), record("2026-10-24"), record(null), record("not-a-date"), record("2026-02-30"),
    record("2026-11-02"), record("2026-09-01", "UNREGISTERED"), record(undefined),
  ], today);
  assert.deepEqual(result.dates, ["2026-10-01", "2026-10-24"]);
  assert.equal(result.undated, 3, "null, malformed and impossible dates");
  assert.equal(result.future, 1);
});

test("year view buckets by year and zero-fills the gaps up to the current year", () => {
  const series = buildTimeSeries(["2022-05-01", "2022-06-01", "2024-01-15", "2026-03-03"], "2026-10-24");
  assert.deepEqual(series.years.map((point) => [point.year, point.count]), [[2022, 2], [2023, 0], [2024, 1], [2025, 0], [2026, 1]]);
  assert.deepEqual(series.years.filter((point) => point.current).map((point) => point.year), [2026]);
  assert.deepEqual(series.kpis.year.peak, { label: "2022", count: 2 });
  assert.equal(series.kpis.year.changePct, null, "previous year had no students, so no percentage");
});

test("month view compares this year with last year and stops at the current month", () => {
  const series = buildTimeSeries(["2025-03-10", "2025-03-11", "2025-12-01", "2026-03-05", "2026-10-02", "2026-10-03", "2026-10-04"], "2026-10-24");
  const [jan, , mar, , , , , , , oct, nov] = series.months;
  assert.deepEqual([jan.current, jan.previous], [0, 0]);
  assert.deepEqual([mar.current, mar.previous], [1, 2]);
  assert.deepEqual([oct.current, oct.previous], [3, 0]);
  assert.equal(nov.current, null, "future months have no value, so the line ends");
  assert.equal(nov.previous, 0);
  assert.equal(series.months.length, 12);
  assert.equal(series.kpis.month.periodLabel, "Oct 2026");
  assert.equal(series.kpis.month.total, 3);
  assert.equal(series.kpis.month.previousTotal, 0);
  assert.deepEqual(series.kpis.month.peak, { label: "Oct 2026", count: 3 });
});

test("month KPIs compare January with the previous December", () => {
  const series = buildTimeSeries(["2025-12-20", "2025-12-21", "2026-01-05"], "2026-01-10");
  assert.equal(series.kpis.month.previousLabel, "Dec 2025");
  assert.equal(series.kpis.month.previousTotal, 2);
  assert.equal(series.kpis.month.total, 1);
  assert.equal(series.kpis.month.changePct, -50);
});

test("week view zero-fills every ISO week, ends at the current week and keeps the last 52", () => {
  const dates = ["2026-10-05", "2026-10-06", "2026-10-19", "2026-10-20", "2026-10-21"];
  const series = buildTimeSeries(dates, "2026-10-24");
  assert.equal(series.weeks.length, 3, "from the first dated week to the current one");
  assert.deepEqual(series.weeks.map((week) => [week.weekStart, week.count]), [["2026-10-05", 2], ["2026-10-12", 0], ["2026-10-19", 3]]);
  assert.deepEqual(series.weeks.map((week) => week.label), ["W41", "W42", "W43"]);
  assert.equal(series.weeks[2].current, true);
  assert.equal(series.kpis.week.total, 3);
  assert.equal(series.kpis.week.previousTotal, 0);

  const long = buildTimeSeries(["2020-01-06", ...dates], "2026-10-24");
  assert.equal(long.weeks.length, WEEK_WINDOW);
  assert.equal(long.weeks.at(-1)!.weekStart, "2026-10-19");
  assert.ok(long.weeks.every((week) => week.average !== null), "history before the window fills the moving average");
});

test("the 4-week moving average is trailing and null until a full window exists", () => {
  assert.deepEqual(trailingAverage([4, 0, 8, 0, 4, 4]), [null, null, null, 3, 3, 4]);
  assert.deepEqual(trailingAverage([1, 2]), [null, null]);
  assert.deepEqual(trailingAverage([]), []);
});

test("percentage change and an empty dataset are handled without inventing numbers", () => {
  const up = buildTimeSeries(["2025-04-01", "2026-04-01", "2026-05-01", "2026-06-01"], "2026-10-24");
  assert.equal(up.kpis.year.total, 3);
  assert.equal(up.kpis.year.previousTotal, 1);
  assert.equal(up.kpis.year.changePct, 200);
  const empty = buildTimeSeries([], "2026-10-24");
  assert.equal(empty.counted, 0);
  assert.equal(empty.kpis.year.peak, null);
  assert.equal(empty.kpis.week.total, 0);
  assert.deepEqual(empty.years.map((point) => point.count), [0]);
});

test("day view zero-fills the last 30 days ending today, with a trailing 7-day average", () => {
  const today = "2026-10-24";
  const series = buildTimeSeries(["2026-10-24", "2026-10-24", "2026-10-23", "2026-10-20", "2026-10-18", "2026-09-01"], today);
  assert.equal(series.days.length, DAY_WINDOW);
  assert.equal(series.days[0].date, "2026-09-25", "29 days before today");
  assert.equal(series.days.at(-1)!.date, today);
  assert.equal(series.days.at(-1)!.current, true);
  assert.deepEqual(series.days.slice(-7).map((day) => day.count), [1, 0, 1, 0, 0, 1, 2]);
  assert.equal(series.days.at(-1)!.average, (1 + 0 + 1 + 0 + 0 + 1 + 2) / 7);
  assert.equal(series.days.find((day) => day.date === "2026-09-25")!.count, 0, "an empty day is zero, not skipped");
  assert.equal(series.days.some((day) => day.date === "2026-09-01"), false, "older than 30 days is outside the window");
});

test("day KPIs compare today with yesterday and find the peak day; the average leans on days before the window", () => {
  const series = buildTimeSeries(["2026-10-24", "2026-10-24", "2026-10-23", "2026-10-22", "2026-10-22", "2026-10-22"], "2026-10-24");
  assert.equal(series.kpis.day.total, 2);
  assert.equal(series.kpis.day.previousTotal, 1);
  assert.equal(series.kpis.day.changePct, 100);
  assert.deepEqual(series.kpis.day.peak, { label: "22 Oct 2026", count: 3 });
  assert.equal(series.kpis.day.periodLabel, "24 Oct 2026");
  assert.equal(series.kpis.day.previousLabel, "23 Oct 2026");
  const lead = buildTimeSeries(["2026-08-25", "2026-08-26"], "2026-09-23");
  assert.equal(lead.days[0].date, "2026-08-25");
  assert.equal(lead.days[0].average, 1 / 7, "the first shown day's average counts the six days before it");
  assert.equal(lead.days[1].average, 2 / 7);
  const none = buildTimeSeries([], "2026-10-24");
  assert.equal(none.kpis.day.peak, null);
  assert.equal(none.kpis.day.changePct, null);
});
