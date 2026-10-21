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
