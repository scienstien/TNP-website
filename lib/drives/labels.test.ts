import assert from "node:assert/strict";
import test from "node:test";
import { driveLabels, numberDuplicates, roleName } from "./labels";

test("unique labels stay plain; repeated ones get (1), (2) in order, never an ID", () => {
  assert.deepEqual(numberDuplicates(["Main", "Pool", "main", "Main"]), ["Main (1)", "Pool", "main (2)", "Main (3)"]);
  assert.deepEqual(driveLabels([{ reference: "Round 1" }, { reference: null }, { reference: " " }]), ["Round 1", "No reference (1)", "No reference (2)"]);
});

test("keys decide sameness when the shown label omits part of the identity", () => {
  assert.deepEqual(numberDuplicates(["Software · Round 1", "Software · Round 1"], ["SDE", "Analyst"]), ["Software · Round 1", "Software · Round 1"]);
  assert.deepEqual(numberDuplicates(["Software · Round 1", "Software · Round 1"], ["SDE", "SDE"]), ["Software · Round 1 (1)", "Software · Round 1 (2)"]);
});

test("role names show the title and, when recorded, the domain", () => {
  assert.equal(roleName({ jobTitle: "Supply Engineer", domain: "Production" }), "Supply Engineer · Production");
  assert.equal(roleName({ jobTitle: null, domain: null }), "Unspecified title");
});
