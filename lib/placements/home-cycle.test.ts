import assert from "node:assert/strict";
import test from "node:test";
import { homeCycleSummaries } from "./home-cycle";
import type { PlacementRecord } from "./types";

const record = (
  rollNumber: number,
  cycleId: string,
  cycleCode: string,
  registrationStatus: PlacementRecord["registrationStatus"],
  company: string | null,
): PlacementRecord => ({
  department: "mme",
  rollNumber,
  batchYear: 2027,
  cycleId,
  cycleCode,
  cycleStartsOn: null,
  cycleEndsOn: null,
  registrationStatus,
  offer: company ? {
    company,
    sector: null,
    packageLpa: null,
    offerType: null,
    offerDate: null,
  } : null,
});

test("builds registered full-cycle totals and distinct offer companies", () => {
  const summaries = homeCycleSummaries([
    record(900000001, "cycle-a", "2026-27", "REGISTERED", "Company A"),
    record(900000002, "cycle-a", "2026-27", "REGISTERED", "Company A"),
    record(900000003, "cycle-a", "2026-27", "REGISTERED", null),
    record(900000004, "cycle-a", "2026-27", "UNREGISTERED", null),
  ]);

  assert.deepEqual(summaries, [{
    cycleId: "cycle-a",
    cycleCode: "2026-27",
    placed: 2,
    unplaced: 1,
    companies: ["Company A"],
  }]);
});

test("keeps explicit cycles that have no registered participation", () => {
  const summaries = homeCycleSummaries([
    record(900000005, "cycle-b", "special", "UNREGISTERED", null),
  ]);

  assert.equal(summaries[0].cycleCode, "special");
  assert.equal(summaries[0].placed + summaries[0].unplaced, 0);
});
