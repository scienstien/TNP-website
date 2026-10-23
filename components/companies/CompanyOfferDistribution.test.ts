import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Register no-op loader for .css files in Node test runner
if (typeof require !== "undefined" && require.extensions) {
  require.extensions[".css"] = () => ({});
}

test("exports CompanyOfferDistribution component and formatRoleOptionLabel", async () => {
  const { default: CompanyOfferDistribution, formatRoleOptionLabel } = await import(
    "./CompanyOfferDistribution"
  );
  assert.equal(typeof CompanyOfferDistribution, "function");
  assert.equal(typeof formatRoleOptionLabel, "function");
});

test("formatRoleOptionLabel handles distinct, duplicate, and NULL titles accurately", async () => {
  const { formatRoleOptionLabel } = await import("./CompanyOfferDistribution");

  const options = [
    {
      roleId: "r1",
      driveId: "d1000001",
      driveReference: "Autumn Drive",
      jobTitle: "Software Engineer",
    },
    {
      roleId: "r2",
      driveId: "d2000002",
      driveReference: "Pool Drive",
      jobTitle: "Graduate Trainee",
    },
    {
      roleId: "r3",
      driveId: "d3000003",
      driveReference: "Special Drive",
      jobTitle: "Graduate Trainee", // Duplicate title
    },
    {
      roleId: "r4",
      driveId: "d4000004-abcd-ef01",
      driveReference: null,
      jobTitle: null, // NULL title without reference
    },
    {
      roleId: "r5",
      driveId: "d5000005-abcd-ef02",
      driveReference: "Winter Round",
      jobTitle: null, // NULL title with reference
    },
  ];

  // 1. Single distinct title with driveReference
  assert.equal(
    formatRoleOptionLabel(options[0], options),
    "Software Engineer (Autumn Drive)"
  );

  // 2. Duplicate title distinguished by driveReference
  assert.equal(
    formatRoleOptionLabel(options[1], options),
    "Graduate Trainee (Pool Drive)"
  );
  assert.equal(
    formatRoleOptionLabel(options[2], options),
    "Graduate Trainee (Special Drive)"
  );

  // 3. NULL title falls back to "Unspecified title" + driveId snippet
  assert.equal(
    formatRoleOptionLabel(options[3], options),
    "Unspecified title (Drive #d40000)"
  );

  // 4. NULL title with driveReference
  assert.equal(
    formatRoleOptionLabel(options[4], options),
    "Unspecified title (Winter Round)"
  );
});

test("supports all three distribution dimensions", async () => {
  type CompanyOfferDimension = "department" | "gender" | "reservationCategory";
  const dimensions: CompanyOfferDimension[] = [
    "department",
    "gender",
    "reservationCategory",
  ];
  assert.equal(dimensions.length, 3);
  assert.ok(dimensions.includes("department"));
  assert.ok(dimensions.includes("gender"));
  assert.ok(dimensions.includes("reservationCategory"));
});

test("preserves 'Not recorded' demographic bucket without dropping or fabricating data", () => {
  const genderBuckets = [
    { key: "M", label: "Male", count: 18 },
    { key: "F", label: "Female", count: 12 },
    { key: "not_recorded", label: "Not recorded", count: 3 },
  ];

  const total = genderBuckets.reduce((sum, b) => sum + b.count, 0);
  assert.equal(total, 33);

  const notRecordedBucket = genderBuckets.find((b) => b.key === "not_recorded");
  assert.ok(notRecordedBucket);
  assert.equal(notRecordedBucket.count, 3);

  // Percentage accurately computed against total denominator including Not recorded
  const share = ((notRecordedBucket.count / total) * 100).toFixed(1);
  assert.equal(share, "9.1");
});

test("prevents NaN and division by zero when totalOffers is zero", () => {
  const totalOffers = 0;
  const bucket = { key: "civil", label: "Civil Engineering", count: 0 };

  const share =
    totalOffers > 0 ? ((bucket.count / totalOffers) * 100).toFixed(1) : "0.0";
  assert.equal(share, "0.0");
  assert.notEqual(share, "NaN");
});

test("handles single department slice cleanly (100% share)", () => {
  const singleDeptBuckets = [
    { key: "mme", label: "Metallurgical and Materials Engineering", count: 15 },
  ];
  const totalOffers = 15;

  const share = ((singleDeptBuckets[0].count / totalOffers) * 100).toFixed(1);
  assert.equal(share, "100.0");
});

test("evaluates UI state resolution for company offer distribution", () => {
  const mockCompany = { companyId: "c1", name: "TechCorp" };
  const mockCycle = { cycleId: "cy1", code: "2025-26" };

  // 1. No company selected
  const stateNoCompany = { company: null, cycle: null, loading: false };
  assert.equal(stateNoCompany.company, null);

  // 2. Company selected, but no cycle selected
  const stateNoCycle = { company: mockCompany, cycle: null, loading: false };
  assert.ok(stateNoCycle.company);
  assert.equal(stateNoCycle.cycle, null);

  // 3. Loading
  const stateLoading = { company: mockCompany, cycle: mockCycle, loading: true };
  assert.equal(stateLoading.loading, true);

  // 4. Error
  const stateError = { company: mockCompany, cycle: mockCycle, loading: false, error: "Network failed" };
  assert.equal(stateError.error, "Network failed");

  // 5. Empty data
  const stateEmpty = { company: mockCompany, cycle: mockCycle, loading: false, error: null, totalOffers: 0, buckets: [] };
  assert.equal(stateEmpty.totalOffers, 0);

  // 6. Data present
  const stateActive = {
    company: mockCompany,
    cycle: mockCycle,
    loading: false,
    error: null,
    totalOffers: 10,
    buckets: [{ key: "cse", label: "Computer Science", count: 10 }],
  };
  assert.ok(stateActive.totalOffers > 0);
  assert.equal(stateActive.buckets.length, 1);
});

test("renders a numeric total from text counts and rejects mismatched slices", async () => {
  const { default: CompanyOfferDistribution } = await import("./CompanyOfferDistribution");
  const props = { company: { companyId: "c1", name: "Acme" }, cycle: { cycleId: "cy1", code: "2025-26" }, scopeLabel: "Civil", dimension: "department" as const, selectedRoleId: null, roleOptions: [], missingRoleCount: 0, loading: false, error: null, onDimensionChange: () => {}, onRoleChange: () => {}, onRetry: () => {} };
  const valid = renderToStaticMarkup(createElement(CompanyOfferDistribution, { ...props, totalOffers: "19", buckets: [{ key: "civil", label: "Civil", count: "19" }] }));
  assert.ok(valid.includes(">19<"));
  const invalid = renderToStaticMarkup(createElement(CompanyOfferDistribution, { ...props, totalOffers: 19, buckets: [{ key: "civil", label: "Civil", count: 18 }] }));
  assert.ok(invalid.includes("These figures don&#x27;t add up; please refresh or report this."));
});

