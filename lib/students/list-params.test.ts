import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_STUDENT_FILTERS, parseStudentListParams, studentListQuery } from "./list-params";

test("empty and malformed parameters fall back to the defaults", () => {
  assert.deepEqual(parseStudentListParams({}), EMPTY_STUDENT_FILTERS);
  assert.deepEqual(parseStudentListParams({ batch: "abc", page: "-3", status: "Hired", dept: "Civil Eng!", company: "" }), EMPTY_STUDENT_FILTERS);
  assert.equal(parseStudentListParams({ page: "2.5" }).page, 1);
  assert.equal(parseStudentListParams({ q: "x".repeat(300) }).q.length, 100);
});

test("valid parameters are parsed, lower-casing the department and taking the first repeated value", () => {
  const filters = parseStudentListParams({ q: " Asha ", dept: "CSE", batch: "2027", company: "DEMO Software", status: ["PPO", "FTE"], page: "3" });
  assert.deepEqual(filters, { q: "Asha", department: "cse", batch: 2027, company: "DEMO Software", status: "PPO", page: 3 });
});

test("the query string round-trips and omits defaults", () => {
  assert.equal(studentListQuery(EMPTY_STUDENT_FILTERS), "");
  const filters = { q: "a b", department: "ece", batch: 2026, company: "DEMO Capital", status: "Unplaced" as const, page: 2 };
  assert.deepEqual(parseStudentListParams(Object.fromEntries(new URLSearchParams(studentListQuery(filters)))), filters);
});
