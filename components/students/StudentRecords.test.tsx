import assert from "node:assert/strict";
import Module from "node:module";
import test from "node:test";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { StudentRecord, StudentResult } from "@/lib/students/types";

// tsx cannot load CSS, and the real Server Actions need auth and a database: stub both.
require.extensions[".css"] = (cssModule) => { cssModule.exports = {}; };
const actionsPath = require.resolve("@/lib/students/actions");
const actions = new Module(actionsPath);
actions.loaded = true;
actions.exports = Object.fromEntries(["createStudent", "createStudentCompany", "deleteStudent", "patchStudent", "removeStudentOffer", "removeStudentParticipation", "setStudentParticipation"]
  .map(name => [name, async () => { throw new Error(`${name} must not run in this test`); }]));
require.cache[actionsPath] = actions;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DeleteAction, deleteBlockedReason, removalConfirmation, sendRemoval } = require("./StudentRecords") as typeof import("./StudentRecords");

const student: StudentRecord = {
  studentId: "10000000-0000-4000-8000-000000000001", enrollmentId: "20000000-0000-4000-8000-000000000001",
  rollNumber: 123456789, name: "Test Student", departmentCode: "civil", programmeId: "30000000-0000-4000-8000-000000000001", programmeLabel: "B.Tech",
  cohortId: "40000000-0000-4000-8000-000000000001", batchYear: 2027, admissionYear: null,
  participations: [{ cycleId: "50000000-0000-4000-8000-000000000001", cycleCode: "26-27", registrationStatus: "REGISTERED" }], offer: null,
};
const placed: StudentRecord = {
  ...student,
  offer: { offerId: "60000000-0000-4000-8000-000000000001", cycleId: "50000000-0000-4000-8000-000000000001", cycleCode: "26-27", companyId: "70000000-0000-4000-8000-000000000001", companyName: "Fictional Alloys", jobRole: null, packageLpa: null, offerType: null, offerDate: null },
};
const noteId = "student-delete-blocked-123456789";

type ElementProps = { children?: ReactNode; [key: string]: unknown };
function elements(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}

test("blocked deletion: a visible reason is linked to the disabled Delete button", () => {
  assert.equal(deleteBlockedReason(placed), "Remove the offer before deleting this student.");
  const html = renderToStaticMarkup(<DeleteAction student={placed} disabled={false} onDelete={() => assert.fail("blocked delete must not run")} />);
  assert.match(html, new RegExp(`<button[^>]*aria-describedby="${noteId}"[^>]*disabled=""`));
  assert.ok(html.includes(`<p class="student-action-note" id="${noteId}">Remove the offer before deleting this student.</p>`));
});

test("confirmed allowed deletion: the confirmation explains the scope and the action sends the stale-check snapshot", async () => {
  assert.equal(deleteBlockedReason(student), null);
  const html = renderToStaticMarkup(<DeleteAction student={student} disabled={false} onDelete={() => {}} />);
  assert.ok(!html.includes("disabled") && !html.includes("aria-describedby") && !html.includes("student-action-note"));

  let deletes = 0;
  const button = elements(DeleteAction({ student, disabled: false, onDelete: () => { deletes += 1; } })).find(element => element.type === "button");
  assert.ok(button);
  (button.props.onClick as () => void)();
  assert.equal(deletes, 1);

  const confirmation = removalConfirmation(student, false);
  assert.ok(confirmation.startsWith("Delete Test Student (123456789)?"));
  assert.ok(confirmation.includes("removes this enrollment and its placement-cycle registrations"));
  assert.ok(confirmation.includes("The person record is kept if they have another enrollment."));
  assert.equal(removalConfirmation(placed, true), "Remove the offer for Test Student? The student will become unplaced.");

  const calls: [number, string][] = [];
  const outcome = await sendRemoval(student, async (roll, expected) => { calls.push([roll, expected]); return { ok: true }; });
  assert.deepEqual(calls, [[123456789, JSON.stringify(student)]]);
  assert.deepEqual(outcome, { feedback: { text: "Record updated.", alert: false }, refresh: true });
});

test("server-side rejection: the exact message is an alert and the record is not refreshed", async () => {
  const reject = (result: StudentResult) => sendRemoval(placed, async () => result);
  assert.deepEqual(await reject({ error: "Remove the student's offer before deleting the student." }),
    { feedback: { text: "Remove the student's offer before deleting the student.", alert: true }, refresh: false });
  assert.deepEqual(await reject({ fieldErrors: { rollNumber: "Enter a nine-digit roll number." } }),
    { feedback: { text: "Enter a nine-digit roll number.", alert: true }, refresh: false });
  assert.deepEqual(await reject({}), { feedback: { text: "Unable to remove record.", alert: true }, refresh: false });
  assert.deepEqual(await sendRemoval(placed, async () => { throw new Error("offline"); }),
    { feedback: { text: "Unable to save. Check your connection and retry.", alert: true }, refresh: false });
});
