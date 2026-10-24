import assert from "node:assert/strict";
import test from "node:test";
import { addDays } from "./dates";
import type { CalendarEvent } from "./types";
import { UPCOMING_MAX_DAYS, UPCOMING_RANGES, upcomingCompanies } from "./upcoming";

const today = "2026-10-24";
let next = 0;
const event = (companyId: string, scheduledDate: string | null, overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  eventId: `40000000-0000-4000-8000-${String(++next).padStart(12, "0")}`, driveId: "30000000-0000-4000-8000-000000000001", companyId, companyName: `Company ${companyId}`,
  cycleId: "20000000-0000-4000-8000-000000000001", cycleCode: "26-27", driveReference: null, processType: "PPT", scheduledDate, scope: "WHOLE_DRIVE", label: null, roles: [], ...overrides,
});

test("ranges run 5 to 30 days in steps of 5", () => {
  assert.deepEqual([...UPCOMING_RANGES], [5, 10, 15, 20, 25, 30]);
  assert.equal(UPCOMING_MAX_DAYS, 30);
});

test("counts companies, not stages, from today through today + range; past, later and undated stages are excluded", () => {
  const events = [
    event("a", today), event("a", addDays(today, 2), { processType: "OT" }),
    event("b", addDays(today, 5)), event("c", addDays(today, 6)),
    event("d", addDays(today, -1)), event("e", null),
  ];
  const five = upcomingCompanies(events, today, 5);
  assert.deepEqual(five.companies.map(company => company.companyId), ["a", "b"]);
  assert.equal(five.stageCount, 3);
  assert.equal(five.endsOn, "2026-10-29");
  assert.deepEqual(five.companies[0].events.map(e => e.processType), ["PPT", "OT"]);
  assert.deepEqual(upcomingCompanies(events, today, 10).companies.map(company => company.companyId), ["a", "b", "c"]);
});

test("companies are ordered by their first stage", () => {
  const events = [event("late", addDays(today, 3)), event("soon", addDays(today, 1)), event("soon", addDays(today, 3), { processType: "PI" })];
  const summary = upcomingCompanies(events, today, 5);
  assert.deepEqual(summary.companies.map(company => company.companyId), ["soon", "late"]);
  assert.equal(summary.stageCount, 3);
});

test("an empty range reports zero without inventing companies", () => {
  const summary = upcomingCompanies([], today, 30);
  assert.equal(summary.companies.length, 0);
  assert.equal(summary.stageCount, 0);
});
