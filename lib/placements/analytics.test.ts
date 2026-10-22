import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_FILTERS,
  placementCycles,
  previousBatchKpis,
  scopeRecords,
} from "./analytics";
import type { PlacementRecord } from "./types";

const record = (
  rollNumber: number,
  batchYear: number,
  cycleId: string,
  cycleCode: string,
): PlacementRecord => ({
  department: "mme",
  rollNumber,
  batchYear,
  cycleId,
  cycleCode,
  cycleStartsOn: null,
  cycleEndsOn: null,
  registrationStatus: "REGISTERED",
  offer: null,
});

const records = [
  record(900000001, 2027, "cycle-a", "2026-27"),
  record(900000002, 2026, "cycle-a", "2026-27"),
  record(900000003, 2027, "cycle-b", "special-2027"),
  record(900000004, 2025, "cycle-b", "special-2027"),
];

test("lists each explicit placement cycle once", () => {
  assert.deepEqual(placementCycles(records), [
    { id: "cycle-a", code: "2026-27" },
    { id: "cycle-b", code: "special-2027" },
  ]);
});

test("scopes participation records by cycle and batch", () => {
  const scope = scopeRecords(records, {
    ...EMPTY_FILTERS,
    cycleId: "cycle-a",
    batchYear: 2027,
  });
  assert.deepEqual(scope.population.map((item) => item.rollNumber), [900000001]);
});

test("clearing the cycle includes participation from every cycle", () => {
  const scope = scopeRecords(records, { ...EMPTY_FILTERS, batchYear: 2027 });
  assert.deepEqual(scope.population.map((item) => item.rollNumber), [900000001, 900000003]);
});

test("previous-batch comparison stays within the selected cycle", () => {
  const previous = previousBatchKpis(records, {
    ...EMPTY_FILTERS,
    cycleId: "cycle-a",
    batchYear: 2027,
  });
  assert.equal(previous?.batchYear, 2026);
  assert.equal(previous?.kpis.total, 1);
});
