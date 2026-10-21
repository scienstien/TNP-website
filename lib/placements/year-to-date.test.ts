import assert from "node:assert/strict";
import test from "node:test";
import { batchYearForDate, sameDateLastYear, yearToDateComparison } from "./year-to-date";

const offers = (batchYear: number, ...offerDates: Array<string | null>) =>
  offerDates.map((offerDate) => ({ batchYear, offerDate }));

test("counts each selected batch through its matching cutoff date", () => {
  const result = yearToDateComparison([
    ...offers(2027, "2025-07-01", "2026-10-20", "2026-10-21"),
    ...offers(2026, "2024-07-01", "2025-10-20", "2025-10-21", null),
  ], "2026-10-20");
  assert.equal(result.current.count, 2);
  assert.equal(result.previous.count, 2);
  assert.equal(result.difference, 0);
  assert.equal(result.pctChange, 0);
  assert.equal(result.undated, 1);
  assert.equal(result.current.batchYear, 2027);
  assert.equal(result.previous.batchYear, 2026);
});

test("counts distinct companies that had come by each cutoff date", () => {
  const result = yearToDateComparison([
    { batchYear: 2027, offerDate: "2026-08-01", company: "A" },
    { batchYear: 2027, offerDate: "2026-09-01", company: "A" },
    { batchYear: 2027, offerDate: "2026-10-01", company: "B" },
    { batchYear: 2027, offerDate: "2026-10-21", company: "C" },
    { batchYear: 2027, offerDate: null, company: "D" },
    { batchYear: 2026, offerDate: "2025-08-01", company: "A" },
    { batchYear: 2026, offerDate: "2025-12-01", company: "B" },
  ], "2026-10-20");
  assert.equal(result.current.count, 3);
  assert.deepEqual(result.current.companies, ["A", "B"]);
  assert.equal(result.previous.count, 1);
  assert.deepEqual(result.previous.companies, ["A"]);
  const missing = yearToDateComparison([{ batchYear: 2027, offerDate: "2026-08-01", company: "A" }], "2026-10-20");
  assert.equal(missing.previous.companies, null);
});

test("distinguishes missing historical dates from a measured zero", () => {
  const missing = yearToDateComparison([...offers(2027, "2026-07-01"), ...offers(2026, null)], "2026-10-20");
  assert.equal(missing.previous.count, null);
  assert.equal(missing.difference, null);
  assert.equal(missing.pctChange, null);
  const zero = yearToDateComparison([
    ...offers(2027, "2026-07-01", "2026-01-01"),
    ...offers(2026, "2025-10-21"),
  ], "2026-10-20");
  assert.equal(zero.previous.count, 0);
  assert.equal(zero.difference, 2);
  assert.equal(zero.pctChange, null);
});

test("calculates both increases and decreases", () => {
  const increase = yearToDateComparison([...offers(2027, "2026-07-01", "2026-08-01"), ...offers(2026, "2025-07-01")], "2026-10-20");
  assert.equal(increase.difference, 1);
  assert.equal(increase.pctChange, 100);
  const decrease = yearToDateComparison([...offers(2027, "2026-07-01"), ...offers(2026, "2025-08-01", "2025-07-01")], "2026-10-20");
  assert.equal(decrease.difference, -1);
  assert.equal(decrease.pctChange, -50);
});

test("clamps leap day to February 28 in the previous year", () => {
  assert.equal(sameDateLastYear("2024-02-29"), "2023-02-28");
  const result = yearToDateComparison([...offers(2024, "2024-02-29"), ...offers(2023, "2023-02-28", "2023-03-01")], "2024-02-29");
  assert.equal(result.current.count, 1);
  assert.equal(result.previous.count, 1);
  assert.equal(result.current.to, "2024-02-29");
  assert.equal(result.previous.to, "2023-02-28");
});

test("January uses the calendar year's batch and the previous calendar year's batch", () => {
  const result = yearToDateComparison([
    ...offers(2026, "2025-06-30", "2025-07-01", "2025-12-31", "2026-01-01", "2026-01-02"),
    ...offers(2025, "2024-07-01", "2024-12-31", "2025-01-01"),
  ], "2026-01-01");
  assert.equal(result.current.batchYear, 2026);
  assert.equal(result.previous.batchYear, 2025);
  assert.equal(result.previous.to, "2025-01-01");
  assert.equal(result.current.count, 4);
  assert.equal(result.previous.count, 3);
});

test("switches to the next graduating batch when the July placement season starts", () => {
  const dates = [
    ...offers(2026, "2025-07-01", "2026-06-30"),
    ...offers(2027, "2026-07-01"),
    ...offers(2025, "2025-07-01"),
  ];
  const june = yearToDateComparison(dates, "2026-06-30");
  assert.equal(june.current.count, 2);
  const july = yearToDateComparison(dates, "2026-07-01");
  assert.equal(july.current.count, 1);
  assert.equal(july.previous.count, 1);
});

test("empty data does not fabricate historical counts or percentages", () => {
  const result = yearToDateComparison([], "2026-10-20");
  assert.equal(result.current.count, 0);
  assert.equal(result.previous.count, null);
  assert.equal(result.pctChange, null);
  assert.equal(result.undated, 0);
});

test("ignores offers from every batch other than the selected and immediately previous batches", () => {
  const result = yearToDateComparison([
    ...offers(2027, "2026-07-01", "2026-10-20", null),
    ...offers(2026, "2025-07-01", "2025-10-20", null),
    ...offers(2025, "2026-10-20", null),
    ...offers(2028, "2026-10-20", null),
  ], "2026-10-20");
  assert.equal(result.current.count, 2);
  assert.equal(result.previous.count, 2);
  assert.equal(result.undated, 2);
});

test("maps the July-to-June placement season to its graduating batch", () => {
  assert.equal(batchYearForDate("2026-06-30"), 2026);
  assert.equal(batchYearForDate("2026-07-01"), 2027);
  assert.equal(batchYearForDate("2026-10-21"), 2027);
  assert.equal(batchYearForDate("2027-01-01"), 2027);
});

test("moves a date into another batch's July-to-June season", async () => {
  const { dateInBatch } = await import("./year-to-date");
  assert.equal(dateInBatch("2026-10-21", 2025), "2024-10-21");
  assert.equal(dateInBatch("2026-03-05", 2025), "2025-03-05");
  assert.equal(dateInBatch("2028-02-29", 2027), "2027-02-28");
  assert.equal(batchYearForDate(dateInBatch("2026-10-21", 2023)), 2023);
});

test("compares against any chosen batch at the same day and month of its own season", () => {
  const result = yearToDateComparison([
    ...offers(2027, "2026-08-01", "2026-10-22"),
    ...offers(2024, "2023-08-01", "2023-10-21", "2023-10-22"),
  ], "2026-10-21", 2024);
  assert.equal(result.current.count, 1);
  assert.equal(result.previous.batchYear, 2024);
  assert.equal(result.previous.to, "2023-10-21");
  assert.equal(result.previous.count, 2);
  assert.equal(result.difference, -1);
});

test("trend applies the same day and month cutoff to each batch and keeps missing batches missing", async () => {
  const { batchTrend } = await import("./year-to-date");
  const trend = batchTrend([
    { batchYear: 2027, offerDate: "2026-10-01", company: "A" },
    { batchYear: 2027, offerDate: "2026-10-22", company: "B" },
    { batchYear: 2025, offerDate: "2024-08-01", company: "A" },
    { batchYear: 2025, offerDate: "2024-09-01", company: "A" },
    { batchYear: 2025, offerDate: null, company: "C" },
    { batchYear: 2010, offerDate: "2009-08-01", company: "Z" },
  ], "2026-10-21", 2027, 3);
  assert.deepEqual(trend.map((point) => point.batchYear), [2027, 2026, 2025]);
  assert.deepEqual([trend[0].placed, trend[0].companies], [1, 1]);
  assert.deepEqual([trend[1].placed, trend[1].companies], [null, null]);
  assert.deepEqual([trend[2].placed, trend[2].companies], [2, 1]);
  assert.equal(trend[2].to, "2024-10-21");
});
