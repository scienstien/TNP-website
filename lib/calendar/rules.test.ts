import assert from "node:assert/strict";
import test from "node:test";
import { assertRoleMembership, monthWindow, validateEvent } from "./rules";
import { PROCESS_LABELS, PROCESS_TYPES, processTypeForLabel } from "./labels";

const driveId = "10000000-0000-4000-8000-000000000001";
const roleId = "10000000-0000-4000-8000-000000000002";
const base = { driveId, processType: "PPT", scheduledDate: null, scope: "WHOLE_DRIVE", label: null, roleIds: [] };

test("whole-drive and selected-role cardinality is enforced, including duplicate IDs", () => {
  assert.deepEqual(validateEvent(base), base);
  assert.throws(() => validateEvent({ ...base, roleIds: [roleId] }), /Whole-drive/);
  assert.throws(() => validateEvent({ ...base, scope: "SELECTED_ROLES" }), /at least one/);
  assert.throws(() => validateEvent({ ...base, scope: "SELECTED_ROLES", roleIds: [roleId, roleId] }), /only once/);
  assert.equal(validateEvent({ ...base, scope: "SELECTED_ROLES", roleIds: [roleId] }).roleIds.length, 1);
});
test("every selected role must exist and belong to the event drive", () => {
  assert.doesNotThrow(() => assertRoleMembership([roleId], [{ roleId, driveId }], driveId));
  assert.throws(() => assertRoleMembership([roleId], [], driveId), /belong/);
  assert.throws(() => assertRoleMembership([roleId], [{ roleId, driveId: "other-drive" }], driveId), /belong/);
});
test("dates remain nullable and real, with no PPT or offer ordering restriction", () => {
  for (const scheduledDate of [null, "2024-02-29", "2026-01-01"]) assert.equal(validateEvent({ ...base, scheduledDate }).scheduledDate, scheduledDate);
  for (const scheduledDate of ["", "2026-02-30", "2026-13-01", "22-10-2026", undefined, 42]) assert.throws(() => validateEvent({ ...base, scheduledDate }), /ISO date/);
});
test("event labels are trimmed nullable text capped at 200 characters", () => {
  assert.equal(validateEvent({ ...base, label: "  Historical stage  " }).label, "Historical stage");
  assert.equal(validateEvent({ ...base, label: "   " }).label, null);
  assert.equal(validateEvent({ ...base, label: "x".repeat(200) }).label?.length, 200);
  assert.throws(() => validateEvent({ ...base, label: "x".repeat(201) }));
  assert.throws(() => validateEvent({ ...base, label: 42 }));
});
test("canonical process values map to display labels and back", () => {
  for (const type of PROCESS_TYPES) assert.equal(processTypeForLabel(PROCESS_LABELS[type]), type);
  assert.equal(PROCESS_LABELS.GD, "Group Discussion");
  assert.equal(PROCESS_LABELS.RESUME_SHORTLISTING, "Resume Shortlisting");
  assert.equal(processTypeForLabel("Unknown"), null);
  assert.throws(() => validateEvent({ ...base, processType: "Group Discussion" }));
  assert.throws(() => validateEvent({ ...base, scope: "completed" }));
  assert.throws(() => validateEvent({ ...base, companyName: "Forged" }));
});
test("visible calendar windows use real month ends and never infer placement cycles", () => {
  assert.deepEqual(monthWindow("2024-02", "2026-10-22"), { startsOn: "2024-02-01", endsOn: "2024-02-29" });
  assert.deepEqual(monthWindow("2026-13", "2026-10-22"), { startsOn: "2026-10-01", endsOn: "2026-10-31" });
});
