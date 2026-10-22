import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { companyRecord, companySnapshotMatches, isUuid } from "./records";
import { directoryCondition } from "./directory-condition";

const row = { companyId: "10000000-0000-4000-8000-000000000001", name: "Fictional Metals", domain: null, hrName: null, email: null, phoneNumber: null, remarks: null, pvrStatus: null };

test("company snapshots use stable IDs and detect renamed companies and changed contacts", () => {
  const current = companyRecord(row);
  assert.equal(companySnapshotMatches(current, JSON.stringify(current)), true);
  assert.equal(companySnapshotMatches(companyRecord({ ...row, name: "Renamed Metals" }), JSON.stringify(current)), false);
  assert.equal(companySnapshotMatches(companyRecord({ ...row, email: "hr@example.com" }), JSON.stringify(current)), false);
  assert.equal(companySnapshotMatches(current, "{}"), false);
  assert.equal(companySnapshotMatches(current, "invalid"), false);
  assert.equal(isUuid(row.companyId), true);
  assert.equal(isUuid("Fictional Metals"), false);
});

test("PPT projection changes do not conflict with contact saves or turn unknown PVR into No", () => {
  assert.equal(companySnapshotMatches(companyRecord(row, "2026-10-22"), JSON.stringify(companyRecord(row, "2026-10-01"))), true);
  assert.equal(companyRecord(row).pvrStatus, "unknown");
});

test("directory offers use explicit cycle and UG department, with drive and offerless alternatives", () => {
  const query = new PgDialect().sqlToQuery(directoryCondition("cycle-A", "department-A")!);
  assert.match(query.sql, /o\.cycle_id = \$/);
  assert.match(query.sql, /g\.level = 'UG'/);
  assert.match(query.sql, /p\.department_id = \$/);
  assert.match(query.sql, /not exists/);
  assert.match(query.sql, /d\.cycle_id = \$/);
  assert.doesNotMatch(query.sql, /graduation_year|offer_date|scheduled_date/);
  assert.deepEqual(query.params, ["cycle-A", "cycle-A", "department-A"]);
});

test("no cycle gives contacts only; all-scope cycle reads retain UG and cycle restrictions", () => {
  assert.equal(directoryCondition(null, "department-A"), undefined);
  const query = new PgDialect().sqlToQuery(directoryCondition("cycle-B", null)!);
  assert.deepEqual(query.params, ["cycle-B", "cycle-B"]);
  assert.match(query.sql, /g\.level = 'UG'/);
  assert.doesNotMatch(query.sql, /p\.department_id/);
});
