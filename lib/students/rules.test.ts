import { test } from "node:test";
import assert from "node:assert/strict";
import {
  offerTarget,
  participationRemovalProblem,
  registrationChangeProblem,
  sharedPersonProblem,
  type Participation,
} from "./rules";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const registered = (cycleId: string): Participation => ({ cycleId, registrationStatus: "REGISTERED" });
const unregistered = (cycleId: string): Participation => ({ cycleId, registrationStatus: "UNREGISTERED" });

test("an existing offer stays in its own cycle when the enrollment has two participations", () => {
  assert.deepEqual(offerTarget([registered(A), registered(B)], B), { cycleId: B });
  assert.deepEqual(offerTarget([registered(A), registered(B)], B, B), { cycleId: B });
  assert.ok(offerTarget([registered(A), registered(B)], B, A).problem, "an offer is never moved to another cycle");
});

test("a new offer with two participations needs an explicit cycle", () => {
  assert.ok(offerTarget([registered(A), registered(B)], null).problem);
  assert.deepEqual(offerTarget([registered(A), registered(B)], null, A), { cycleId: A });
});

test("a single participation is the only possible target", () => {
  assert.deepEqual(offerTarget([registered(A)], null), { cycleId: A });
  assert.ok(offerTarget([registered(A)], null, B).problem, "a cycle the enrollment is not part of is rejected");
});

test("an enrollment with no participation cannot receive an offer", () => {
  assert.ok(offerTarget([], null).problem);
  assert.ok(offerTarget([], null, A).problem);
});

test("UNREGISTERED participation cannot hold an offer, new or existing", () => {
  assert.ok(offerTarget([unregistered(A)], null).problem);
  assert.ok(offerTarget([unregistered(A), registered(B)], null, A).problem);
  assert.ok(offerTarget([unregistered(A)], A).problem, "editing an offer attached to UNREGISTERED participation is rejected");
  assert.deepEqual(offerTarget([unregistered(A), registered(B)], null, B), { cycleId: B });
});

test("a participation holding the offer cannot become UNREGISTERED; others can", () => {
  assert.ok(registrationChangeProblem(A, A, "UNREGISTERED"), "never removes an offer to make unregistration succeed");
  assert.equal(registrationChangeProblem(A, A, "REGISTERED"), null);
  assert.equal(registrationChangeProblem(A, B, "UNREGISTERED"), null, "another cycle of the same enrollment");
  assert.equal(registrationChangeProblem(null, A, "UNREGISTERED"), null);
});

test("a participation holding the offer cannot be removed; others can", () => {
  assert.ok(participationRemovalProblem(A, A));
  assert.equal(participationRemovalProblem(A, B), null);
  assert.equal(participationRemovalProblem(null, A), null);
});

test("shared-person edits are limited to people whose enrollments are all in the department", () => {
  assert.equal(sharedPersonProblem("dept-1", []), null);
  assert.equal(sharedPersonProblem("dept-1", ["dept-1"]), null);
  assert.ok(sharedPersonProblem("dept-1", ["dept-2"]));
  assert.ok(sharedPersonProblem("dept-1", ["dept-1", "dept-2"]));
});
