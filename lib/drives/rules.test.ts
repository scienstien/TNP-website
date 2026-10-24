import assert from "node:assert/strict";
import test from "node:test";
import { assertSnapshot, canManageDrives, validateDrive, validateDriveHr, validateNewCompanyDrives, validateNewRoles, validateRole } from "./rules";

const id = "10000000-0000-4000-8000-000000000001";
const hr = { hrName: " Asha  Rao ", hrEmail: "Asha@Example.com", hrPhoneNumber: "+91 98765 43210" };
const roles = [{ jobTitle: "Engineer" }];
const newDrive = (overrides: Record<string, unknown> = {}) => ({ companyId: id, cycleId: id, ...hr, roles, ...overrides });

test("drive, role and process-stage writes require an administrator and a chosen department", () => {
  assert.equal(canManageDrives("SUPERADMIN", true), true);
  assert.equal(canManageDrives("ADMIN", true), true);
  for (const [role, department] of [["SUPERADMIN", false], ["ADMIN", false], ["PROFESSOR", true], [null, true]] as const) assert.equal(canManageDrives(role, department), false);
});
test("drives drafted with a new company carry a cycle, HR contact, roles with domains and whole-drive stages, never a company ID", () => {
  assert.deepEqual(validateNewCompanyDrives([{ cycleId: id, reference: " Round 1 ", ...hr, roles: [{ jobTitle: " Supply Engineer ", domain: " Production " }, { jobTitle: "SDE", domain: "" }], stages: [{ processType: "PPT", scheduledDate: "2026-08-01", label: " Hall A " }, { processType: "PI", scheduledDate: null }] }]),
    [{ cycleId: id, reference: "Round 1", hrName: "Asha Rao", hrEmail: "asha@example.com", hrPhoneNumber: "+91 98765 43210", roles: [{ jobTitle: "Supply Engineer", domain: "Production" }, { jobTitle: "SDE", domain: null }], stages: [{ processType: "PPT", scheduledDate: "2026-08-01", label: "Hall A" }, { processType: "PI", scheduledDate: null, label: null }] }]);
  assert.deepEqual(validateNewCompanyDrives(undefined), []);
  assert.throws(() => validateNewCompanyDrives([{ cycleId: id, ...hr, roles, companyId: id }]));
  assert.throws(() => validateNewCompanyDrives([{ cycleId: "forged", ...hr, roles }]));
  assert.throws(() => validateNewCompanyDrives({}));
  assert.throws(() => validateNewRoles(Array.from({ length: 21 }, () => ({ jobTitle: "Engineer" }))));
  assert.deepEqual(validateDrive(newDrive(), true).stages, []);
});
test("every drive needs a complete, valid HR contact", () => {
  for (const missing of ["hrName", "hrEmail", "hrPhoneNumber"]) {
    assert.throws(() => validateDrive(newDrive({ [missing]: "  " }), true), /HR/);
    assert.throws(() => validateDrive({ reference: null, ...hr, [missing]: null }, false), /HR/);
  }
  assert.throws(() => validateDriveHr({ ...hr, hrEmail: "not-an-email" }), /email/);
  assert.throws(() => validateDriveHr({ ...hr, hrPhoneNumber: "call me" }), /phone/);
});
test("a new drive needs at least one titled role", () => {
  for (const value of [undefined, null, [], [{ jobTitle: "" }], [{ jobTitle: "  " }], [{ jobTitle: "Engineer" }, { jobTitle: "" }], ["Engineer"]]) {
    assert.throws(() => validateDrive(newDrive({ roles: value }), true), /role|title|Invalid/);
    assert.throws(() => validateNewCompanyDrives([{ cycleId: id, ...hr, roles: value }]), /role|title|Invalid/);
  }
  assert.throws(() => validateRole({ driveId: id, jobTitle: " " }, true), /title/);
});
test("drafted stages need a known stage and a real date or none", () => {
  for (const stage of [{ processType: "INTERVIEW" }, { processType: "PPT", scheduledDate: "2026-02-30" }, { processType: "PPT", scope: "SELECTED_ROLES" }]) {
    assert.throws(() => validateDrive(newDrive({ stages: [stage] }), true));
  }
});
test("references, role titles and domains are optional trimmed text with length limits on edit", () => {
  assert.equal(validateDrive(newDrive({ reference: "  Historical round  " }), true).reference, "Historical round");
  for (const value of [null, undefined, "", "   "]) {
    assert.equal(validateDrive({ reference: value, ...hr }, false).reference, null);
    assert.equal(validateRole({ jobTitle: value }, false).jobTitle, null);
    assert.equal(validateRole({ jobTitle: "Engineer", domain: value }, false).domain, null);
  }
  assert.equal(validateRole({ driveId: id, jobTitle: " Engineer ", domain: " Software " }, true).domain, "Software");
  for (const value of [42, [], "x".repeat(121)]) {
    assert.throws(() => validateRole({ jobTitle: value }, false));
    assert.throws(() => validateDrive({ reference: value, ...hr }, false));
  }
  assert.throws(() => validateRole({ jobTitle: "Engineer", domain: "x".repeat(81) }, false));
});
test("drive company/cycle and role parent cannot be changed and forged IDs are rejected", () => {
  assert.throws(() => validateDrive({ companyId: id, ...hr }, false));
  assert.throws(() => validateDrive({ cycleId: id, ...hr }, false));
  assert.throws(() => validateRole({ driveId: id }, false));
  assert.throws(() => validateDrive(newDrive({ companyId: "forged" }), true));
  assert.throws(() => validateRole({ driveId: "forged", jobTitle: "Engineer" }, true));
  assert.throws(() => validateDrive(null, true));
});
test("repeated role titles remain valid and stale snapshots reject edits", () => {
  assert.deepEqual(validateRole({ driveId: id, jobTitle: "Engineer" }, true), validateRole({ driveId: id, jobTitle: "Engineer" }, true));
  assert.doesNotThrow(() => assertSnapshot({ reference: null }, '{"reference":null}', "drive"));
  assert.throws(() => assertSnapshot({ reference: "changed" }, '{"reference":null}', "drive"), /changed/);
});
