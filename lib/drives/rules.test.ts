import assert from "node:assert/strict";
import test from "node:test";
import { assertSnapshot, canManageHistorical, validateDrive, validateRole } from "./rules";

const id = "10000000-0000-4000-8000-000000000001";
test("drive and role writes require SUPERADMIN and a chosen department", () => {
  assert.equal(canManageHistorical("SUPERADMIN", true), true);
  for (const [role, department] of [["SUPERADMIN", false], ["ADMIN", true], ["PROFESSOR", true], [null, true]] as const) assert.equal(canManageHistorical(role, department), false);
});
test("references and role titles are optional trimmed text with a 120 character limit", () => {
  assert.equal(validateDrive({ companyId: id, cycleId: id, reference: "  Historical round  " }, true).reference, "Historical round");
  for (const value of [null, undefined, "", "   "]) {
    assert.equal(validateDrive({ reference: value }, false).reference, null);
    assert.equal(validateRole({ jobTitle: value }, false).jobTitle, null);
  }
  assert.equal(validateRole({ driveId: id, jobTitle: " Engineer " }, true).jobTitle, "Engineer");
  for (const value of [42, [], "x".repeat(121)]) {
    assert.throws(() => validateRole({ jobTitle: value }, false));
    assert.throws(() => validateDrive({ reference: value }, false));
  }
});
test("drive company/cycle and role parent cannot be changed and forged IDs are rejected", () => {
  assert.throws(() => validateDrive({ companyId: id }, false));
  assert.throws(() => validateDrive({ cycleId: id }, false));
  assert.throws(() => validateRole({ driveId: id }, false));
  assert.throws(() => validateDrive({ companyId: "forged", cycleId: id }, true));
  assert.throws(() => validateRole({ driveId: "forged" }, true));
  assert.throws(() => validateDrive(null, true));
});
test("repeated role titles remain valid and stale snapshots reject edits", () => {
  assert.deepEqual(validateRole({ driveId: id, jobTitle: "Engineer" }, true), validateRole({ driveId: id, jobTitle: "Engineer" }, true));
  assert.doesNotThrow(() => assertSnapshot({ reference: null }, '{"reference":null}', "drive"));
  assert.throws(() => assertSnapshot({ reference: "changed" }, '{"reference":null}', "drive"), /changed/);
});
