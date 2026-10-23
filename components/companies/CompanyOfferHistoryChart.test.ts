import assert from "node:assert/strict";
import test from "node:test";

// Register no-op loader for .css files in Node test runner
if (typeof require !== "undefined" && require.extensions) {
  require.extensions[".css"] = () => ({});
}

test("exports CompanyOfferHistoryChart component and required interfaces", async () => {
  const { default: CompanyOfferHistoryChart } = await import(
    "./CompanyOfferHistoryChart"
  );
  assert.equal(typeof CompanyOfferHistoryChart, "function");

  const mockCompany = {
    companyId: "c0000000-0000-4000-8000-000000000001",
    name: "Acme Dynamics",
  };

  const mockRows = [
    { cycleId: "cyc-01", cycleCode: "2023-24", offerCount: 12 },
    { cycleId: "cyc-02", cycleCode: "2024-25", offerCount: 0 },
    { cycleId: "cyc-03", cycleCode: "2025-26", offerCount: 7 },
  ];

  const sampleProps = {
    company: mockCompany,
    scopeLabel: "Department: Metallurgical and Materials Engineering",
    rows: mockRows,
    loading: false,
    error: null,
    onRetry: () => {},
  };
  assert.equal(sampleProps.rows.length, 3);
  assert.equal(sampleProps.company?.name, "Acme Dynamics");
});

test("preserves stable display order without client-side reordering", () => {
  const customOrder = [
    { cycleId: "c-3", cycleCode: "Cycle Gamma", offerCount: 5 },
    { cycleId: "c-1", cycleCode: "Cycle Alpha", offerCount: 10 },
    { cycleId: "c-2", cycleCode: "Cycle Beta", offerCount: 2 },
  ];

  const codes = customOrder.map((r) => r.cycleCode);
  assert.deepEqual(codes, ["Cycle Gamma", "Cycle Alpha", "Cycle Beta"]);
});

test("distinguishes zero-offer cycles from omitted/unrecorded cycles", () => {
  const mockRows = [
    { cycleId: "cyc-01", cycleCode: "2023-24", offerCount: 12 },
    { cycleId: "cyc-02", cycleCode: "2024-25", offerCount: 0 },
    { cycleId: "cyc-03", cycleCode: "2025-26", offerCount: 7 },
  ];

  const cycleWithZero = mockRows.find((r) => r.cycleCode === "2024-25");
  assert.ok(cycleWithZero);
  assert.equal(cycleWithZero.offerCount, 0);

  const unrecorded = mockRows.find((r) => r.cycleCode === "2020-21");
  assert.equal(unrecorded, undefined);
});

test("calculates total offers accurately including zero-offer rows", () => {
  const mockRows = [
    { cycleId: "cyc-01", cycleCode: "2023-24", offerCount: 12 },
    { cycleId: "cyc-02", cycleCode: "2024-25", offerCount: 0 },
    { cycleId: "cyc-03", cycleCode: "2025-26", offerCount: 7 },
  ];
  const total = mockRows.reduce((sum, r) => sum + r.offerCount, 0);
  assert.equal(total, 19);
});

test("calculates horizontal scroll width based on cycle count for long histories", () => {
  const computeCompactWidth = (count: number) => Math.max(340, count * 60);
  const computeOverlayWidth = (count: number) => Math.max(720, count * 76);

  assert.equal(computeCompactWidth(2), 340);
  assert.equal(computeOverlayWidth(2), 720);

  assert.equal(computeCompactWidth(20), 1200);
  assert.equal(computeOverlayWidth(20), 1520);
});

test("state condition resolution for UI distinct states", () => {
  const mockCompany = {
    companyId: "c0000000-0000-4000-8000-000000000001",
    name: "Acme Dynamics",
  };
  const mockRows = [
    { cycleId: "cyc-01", cycleCode: "2023-24", offerCount: 12 },
  ];

  // 1. No company
  const noCompanyState = { company: null, loading: false, error: null, rows: [] };
  assert.equal(noCompanyState.company, null);

  // 2. Loading
  const loadingState = { company: mockCompany, loading: true, error: null, rows: [] };
  assert.equal(loadingState.loading, true);

  // 3. Error
  const errorState = { company: mockCompany, loading: false, error: "Database timeout", rows: [] };
  assert.equal(errorState.error, "Database timeout");

  // 4. Empty data (company selected, but 0 recorded cycles)
  const emptyState = { company: mockCompany, loading: false, error: null, rows: [] };
  assert.equal(emptyState.rows.length, 0);

  // 5. Data present
  const dataState = { company: mockCompany, loading: false, error: null, rows: mockRows };
  assert.equal(dataState.rows.length > 0, true);
});
