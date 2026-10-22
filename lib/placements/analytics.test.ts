import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_FILTERS,
  comparisonCycleKpis,
  computeKpis,
  isRegisteredParticipation,
  mergeDashboardFilters,
  placementCycles,
  scopeRecords,
} from "./analytics";
import type { PlacementRecord } from "./types";

const record = (
  rollNumber: number,
  batchYear: number,
  cycleId: string,
  cycleCode: string,
  department = "mme",
): PlacementRecord => ({
  department,
  rollNumber,
  batchYear,
  cycleId,
  cycleCode,
  cycleStartsOn: null,
  cycleEndsOn: null,
  registrationStatus: "REGISTERED",
  offer: null,
});

const withOffer = (
  participation: PlacementRecord,
  company = "Example Company",
): PlacementRecord => ({
  ...participation,
  offer: {
    company,
    sector: "Technology",
    packageLpa: 12,
    offerType: "FTE",
    offerDate: "2026-09-01",
  },
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

test("compares two explicitly selected cycles under the same batch filter", () => {
  const comparison = comparisonCycleKpis(records, {
    ...EMPTY_FILTERS,
    cycleId: "cycle-a",
    comparisonCycleId: "cycle-b",
    batchYear: 2027,
  });
  assert.equal(comparison?.cycleId, "cycle-b");
  assert.equal(comparison?.cycleCode, "special-2027");
  assert.equal(comparison?.kpis.total, 1);
});

test("requires two different explicitly selected cycles", () => {
  assert.equal(comparisonCycleKpis(records, {
    ...EMPTY_FILTERS,
    cycleId: "cycle-a",
  }), null);
  assert.equal(comparisonCycleKpis(records, {
    ...EMPTY_FILTERS,
    cycleId: "cycle-a",
    comparisonCycleId: "cycle-a",
  }), null);
});

test("applies the same offer filters to the comparison cycle", () => {
  const matching = {
    ...record(900000013, 2027, "cycle-b", "special-2027"),
    offer: {
      company: "Matching Company",
      sector: "Technology",
      packageLpa: 15,
      offerType: "FTE" as const,
      offerDate: null,
    },
  };
  const elsewhere = {
    ...record(900000014, 2027, "cycle-b", "special-2027"),
    offer: {
      company: "Other Company",
      sector: "Finance",
      packageLpa: 10,
      offerType: "PPO" as const,
      offerDate: null,
    },
  };
  const comparison = comparisonCycleKpis(
    [record(900000015, 2027, "cycle-a", "2026-27"), matching, elsewhere],
    {
      ...EMPTY_FILTERS,
      cycleId: "cycle-a",
      comparisonCycleId: "cycle-b",
      batchYear: 2027,
      company: "Matching Company",
    },
  );

  assert.equal(comparison?.kpis.total, 2);
  assert.equal(comparison?.kpis.placed, 1);
  assert.equal(comparison?.kpis.placedElsewhere, 1);
});

test("clears invalid comparison selections when the primary cycle changes", () => {
  const selected = {
    ...EMPTY_FILTERS,
    cycleId: "cycle-a",
    comparisonCycleId: "cycle-b",
  };
  assert.equal(
    mergeDashboardFilters(selected, { cycleId: "cycle-b" }).comparisonCycleId,
    null,
  );
  assert.equal(
    mergeDashboardFilters(selected, { cycleId: null }).comparisonCycleId,
    null,
  );
});

test("registered participation with an offer is placed", () => {
  const placed = withOffer(record(900000005, 2027, "cycle-a", "2026-27"));
  const kpis = computeKpis(scopeRecords([placed], EMPTY_FILTERS));

  assert.equal(kpis.total, 1);
  assert.equal(kpis.placed, 1);
  assert.equal(kpis.unplaced, 0);
  assert.equal(kpis.placementPct, 100);
});

test("registered participation without an offer is unplaced", () => {
  const unplaced = record(900000006, 2027, "cycle-a", "2026-27");
  const kpis = computeKpis(scopeRecords([unplaced], EMPTY_FILTERS));

  assert.equal(kpis.total, 1);
  assert.equal(kpis.placed, 0);
  assert.equal(kpis.unplaced, 1);
  assert.equal(kpis.placementPct, 0);
});

test("unregistered participation is excluded from the denominator", () => {
  const unregistered = {
    ...record(900000007, 2027, "cycle-a", "2026-27"),
    registrationStatus: "UNREGISTERED" as const,
  };
  const kpis = computeKpis(scopeRecords(
    [withOffer(record(900000005, 2027, "cycle-a", "2026-27")), unregistered],
    { ...EMPTY_FILTERS, cycleId: "cycle-a", batchYear: 2027 },
  ));

  assert.equal(kpis.total, 1);
  assert.equal(kpis.placed, 1);
  assert.equal(kpis.unplaced, 0);
  assert.equal(kpis.placementPct, 100);
});

test("returns an undefined placement percentage without registered participation", () => {
  const unregistered = {
    ...record(900000008, 2027, "cycle-a", "2026-27"),
    registrationStatus: "UNREGISTERED" as const,
  };
  const kpis = computeKpis(scopeRecords([unregistered], EMPTY_FILTERS));

  assert.equal(kpis.total, 0);
  assert.equal(kpis.placed, 0);
  assert.equal(kpis.unplaced, 0);
  assert.equal(kpis.placementPct, null);
});

test("offer filters do not change the registered denominator", () => {
  const matchingOffer = {
    ...record(900000009, 2027, "cycle-a", "2026-27"),
    offer: {
      company: "Matching Company",
      sector: "Technology",
      packageLpa: 15,
      offerType: "FTE" as const,
      offerDate: null,
    },
  };
  const otherOffer = {
    ...record(900000010, 2027, "cycle-a", "2026-27"),
    offer: {
      company: "Other Company",
      sector: "Finance",
      packageLpa: 10,
      offerType: "PPO" as const,
      offerDate: null,
    },
  };
  const kpis = computeKpis(scopeRecords(
    [matchingOffer, otherOffer],
    { ...EMPTY_FILTERS, company: "Matching Company" },
  ));

  assert.equal(kpis.total, 2);
  assert.equal(kpis.placed, 1);
  assert.equal(kpis.placedElsewhere, 1);
  assert.equal(kpis.placementPct, 50);
});

test("one enrollment in two cycles remains two participation records", () => {
  const repeatedEnrollment = [
    withOffer(record(900000016, 2027, "cycle-a", "2026-27")),
    record(900000016, 2027, "cycle-b", "special-2027"),
  ];
  const kpis = computeKpis(scopeRecords(repeatedEnrollment, EMPTY_FILTERS));

  assert.equal(kpis.total, 2);
  assert.equal(kpis.placed, 1);
  assert.equal(kpis.unplaced, 1);
});

test("an enrollment offer appears only in its owning cycle", () => {
  const repeatedEnrollment = [
    withOffer(record(900000017, 2027, "cycle-a", "2026-27")),
    record(900000017, 2027, "cycle-b", "special-2027"),
  ];
  const firstCycle = computeKpis(scopeRecords(repeatedEnrollment, {
    ...EMPTY_FILTERS,
    cycleId: "cycle-a",
  }));
  const secondCycle = computeKpis(scopeRecords(repeatedEnrollment, {
    ...EMPTY_FILTERS,
    cycleId: "cycle-b",
  }));

  assert.equal(firstCycle.placed, 1);
  assert.equal(firstCycle.unplaced, 0);
  assert.equal(secondCycle.placed, 0);
  assert.equal(secondCycle.unplaced, 1);
});

test("batch filtering works within the department-scoped query population", () => {
  const authorizedDepartmentRecords = [
    record(900000018, 2027, "cycle-a", "2026-27", "civil"),
    record(900000019, 2026, "cycle-a", "2026-27", "civil"),
  ];
  const scope = scopeRecords(authorizedDepartmentRecords, {
    ...EMPTY_FILTERS,
    batchYear: 2027,
  });

  assert.deepEqual(scope.population.map((item) => item.rollNumber), [900000018]);
  assert.ok(scope.population.every((item) => item.department === "civil"));
});

test("shares the registered-participation rule with home calculations", () => {
  const registered = record(900000011, 2027, "cycle-a", "2026-27");
  const unregistered = {
    ...record(900000012, 2027, "cycle-a", "2026-27"),
    registrationStatus: "UNREGISTERED" as const,
  };

  assert.deepEqual(
    [registered, unregistered].filter(isRegisteredParticipation),
    [registered],
  );
});
