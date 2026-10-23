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

test("cycle directory requires a retained explicit drive, independently of offers or department", () => {
  const query = new PgDialect().sqlToQuery(directoryCondition("cycle-A")!);
  assert.match(query.sql, /exists/);
  assert.match(query.sql, /drives/);
  assert.doesNotMatch(query.sql, /placement_offers|programmes|graduation_year|offer_date|scheduled_date/);
  assert.deepEqual(query.params, ["cycle-A"]);
  assert.equal(directoryCondition(null), undefined);
});
