import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_FILTERS,
  comparisonCycleKpis,
  computeKpis,
  defaultFilters,
  isRegisteredParticipation,
  mergeDashboardFilters,
  placementCycles,
  scopeRecords,
} from "./analytics";
import type { PlacementRecord } from "./types";

const record = (
  cycleId: string,
  cycleCode: string,
  department = "mme",
): PlacementRecord => ({
  department,
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
    domain: "Technology",
    packageLpa: 12,
    offerType: "FTE",
    offerDate: "2026-09-01",
  },
});

const records = [
  record("cycle-a", "2026-27"),
  record("cycle-a", "2026-27"),
  record("cycle-b", "special-2027"),
  record("cycle-b", "special-2027"),
];

/** Positions in `source` of the records in a scope (records carry no identifier). */
const positions = (source: PlacementRecord[], scoped: PlacementRecord[]) =>
  scoped.map((item) => source.indexOf(item));

test("lists each explicit placement cycle once, newest first", () => {
  assert.deepEqual(placementCycles(records), [
    { id: "cycle-b", code: "special-2027" },
    { id: "cycle-a", code: "2026-27" },
  ]);
});

test("scopes participation records by cycle", () => {
  const scope = scopeRecords(records, { ...EMPTY_FILTERS, cycleId: "cycle-a" });
  assert.deepEqual(positions(records, scope.population), [0, 1]);
});

test("clearing the cycle includes participation from every cycle", () => {
  const scope = scopeRecords(records, defaultFilters());
  assert.deepEqual(positions(records, scope.population), [0, 1, 2, 3]);
});

test("compares two explicitly selected cycles", () => {
  const comparison = comparisonCycleKpis(records, {
    ...EMPTY_FILTERS,
    cycleId: "cycle-a",
    comparisonCycleId: "cycle-b",
  });
  assert.equal(comparison?.cycleId, "cycle-b");
  assert.equal(comparison?.cycleCode, "special-2027");
  assert.equal(comparison?.kpis.total, 2);
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
    ...record("cycle-b", "special-2027"),
    offer: {
      company: "Matching Company",
      domain: "Technology",
      packageLpa: 15,
      offerType: "FTE" as const,
      offerDate: null,
    },
  };
  const elsewhere = {
    ...record("cycle-b", "special-2027"),
    offer: {
      company: "Other Company",
      domain: "Finance",
      packageLpa: 10,
      offerType: "PPO" as const,
      offerDate: null,
    },
  };
  const comparison = comparisonCycleKpis(
    [record("cycle-a", "2026-27"), matching, elsewhere],
    {
      ...EMPTY_FILTERS,
      cycleId: "cycle-a",
      comparisonCycleId: "cycle-b",
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
  const placed = withOffer(record("cycle-a", "2026-27"));
  const kpis = computeKpis(scopeRecords([placed], EMPTY_FILTERS));

  assert.equal(kpis.total, 1);
  assert.equal(kpis.placed, 1);
  assert.equal(kpis.unplaced, 0);
  assert.equal(kpis.placementPct, 100);
});

test("registered participation without an offer is unplaced", () => {
  const unplaced = record("cycle-a", "2026-27");
  const kpis = computeKpis(scopeRecords([unplaced], EMPTY_FILTERS));

  assert.equal(kpis.total, 1);
  assert.equal(kpis.placed, 0);
  assert.equal(kpis.unplaced, 1);
  assert.equal(kpis.placementPct, 0);
});

test("unregistered participation is excluded from the denominator", () => {
  const unregistered = {
    ...record("cycle-a", "2026-27"),
    registrationStatus: "UNREGISTERED" as const,
  };
  const kpis = computeKpis(scopeRecords(
    [withOffer(record("cycle-a", "2026-27")), unregistered],
    { ...EMPTY_FILTERS, cycleId: "cycle-a" },
  ));

  assert.equal(kpis.total, 1);
  assert.equal(kpis.placed, 1);
  assert.equal(kpis.unplaced, 0);
  assert.equal(kpis.placementPct, 100);
});

test("returns an undefined placement percentage without registered participation", () => {
  const unregistered = {
    ...record("cycle-a", "2026-27"),
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
    ...record("cycle-a", "2026-27"),
    offer: {
      company: "Matching Company",
      domain: "Technology",
      packageLpa: 15,
      offerType: "FTE" as const,
      offerDate: null,
    },
  };
  const otherOffer = {
    ...record("cycle-a", "2026-27"),
    offer: {
      company: "Other Company",
      domain: "Finance",
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
  assert.equal(kpis.placedOverall, 2);
  assert.equal(kpis.placementPct, 50);
});

test("one enrollment in two cycles remains two participation records", () => {
  const repeatedEnrollment = [
    withOffer(record("cycle-a", "2026-27")),
    record("cycle-b", "special-2027"),
  ];
  const kpis = computeKpis(scopeRecords(repeatedEnrollment, EMPTY_FILTERS));

  assert.equal(kpis.total, 2);
  assert.equal(kpis.placed, 1);
  assert.equal(kpis.unplaced, 1);
});

test("an enrollment offer appears only in its owning cycle", () => {
  const repeatedEnrollment = [
    withOffer(record("cycle-a", "2026-27")),
    record("cycle-b", "special-2027"),
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

test("cycle filtering works within the department-scoped query population", () => {
  const authorizedDepartmentRecords = [
    record("cycle-a", "2026-27", "civil"),
    record("cycle-b", "special-2027", "civil"),
  ];
  const scope = scopeRecords(authorizedDepartmentRecords, {
    ...EMPTY_FILTERS,
    cycleId: "cycle-a",
  });

  assert.deepEqual(positions(authorizedDepartmentRecords, scope.population), [0]);
  assert.ok(scope.population.every((item) => item.department === "civil"));
});

test("shares the registered-participation rule with home calculations", () => {
  const registered = record("cycle-a", "2026-27");
  const unregistered = {
    ...record("cycle-a", "2026-27"),
    registrationStatus: "UNREGISTERED" as const,
  };

  assert.deepEqual(
    [registered, unregistered].filter(isRegisteredParticipation),
    [registered],
  );
});

test("cycle options run from the latest year down to 2008, comparing years as numbers", () => {
  const years = [2008, 2009, 2017, 2018, 2027, 2026, 2019];
  const cycles = placementCycles(years.map((year) => ({ ...records[0], cycleId: `id-${year}`, cycleCode: `${year - 1}-${String(year).slice(2)}` })));
  assert.deepEqual(cycles.map((cycle) => cycle.code), ["2026-27", "2025-26", "2018-19", "2017-18", "2016-17", "2008-09", "2007-08"]);
  assert.equal(cycles[0].code, "2026-27");
  assert.equal(cycles.at(-1)!.code, "2007-08");
});
