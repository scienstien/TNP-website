import assert from "node:assert/strict";
import test from "node:test";
import { programmeDestination, programmeFromPath } from "./useProgrammeLevel";

test("dashboard and Student Records routes identify the same programme level", () => {
  assert.equal(programmeFromPath("/dashboard/pg"), "PG");
  assert.equal(programmeFromPath("/students/pg"), "PG");
  assert.equal(programmeFromPath("/dashboard/ug"), "UG");
  assert.equal(programmeFromPath("/students/ug"), "UG");
  assert.equal(programmeFromPath("/companies"), null);
});

test("the top programme selector stays in Student Records when switching levels", () => {
  assert.equal(programmeDestination("/students/ug", "PG"), "/students/pg");
  assert.equal(programmeDestination("/students/pg", "UG"), "/students/ug");
  assert.equal(programmeDestination("/dashboard/pg", "UG"), "/dashboard/ug");
});
