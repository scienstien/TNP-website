import assert from "node:assert/strict";
import test from "node:test";
import { homeCycleSummaries } from "./home-cycle";
import type { PlacementRecord } from "./types";

const record = (
  cycleId: string,
  cycleCode: string,
  registrationStatus: PlacementRecord["registrationStatus"],
  company: string | null,
): PlacementRecord => ({
  programmeId: "programme",
  specialization: null,
  graduationYear: 2026,
  department: "mme",
  cycleId,
  cycleCode,
  cycleStartsOn: null,
  cycleEndsOn: null,
  registrationStatus,
  offer: company ? {
    company,
    domain: null,
    packageLpa: null,
    offerType: null,
    offerDate: null,
  } : null,
});

test("builds registered full-cycle totals and distinct offer companies", () => {
  const summaries = homeCycleSummaries([
    record("cycle-a", "2026-27", "REGISTERED", "Company A"),
    record("cycle-a", "2026-27", "REGISTERED", "Company A"),
    record("cycle-a", "2026-27", "REGISTERED", null),
    record("cycle-a", "2026-27", "UNREGISTERED", null),
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
    record("cycle-b", "special", "UNREGISTERED", null),
  ]);

  assert.equal(summaries[0].cycleCode, "special");
  assert.equal(summaries[0].placed + summaries[0].unplaced, 0);
});
