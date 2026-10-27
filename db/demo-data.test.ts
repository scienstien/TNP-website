import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PG_BRANCHES } from "../lib/placements/pg-catalog";
import { ALL_DEPARTMENTS, createRng, DEPARTMENTS, FIRST_YEAR, fullDemoCohorts, generateStudents, LAST_YEAR, tenThousandStudentCounts } from "./demo-data";

test("10,000 student allocation spans every year and department with proportionate cohorts", () => {
  const cohorts = fullDemoCohorts(Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, index) => FIRST_YEAR + index));
  const counts = tenThousandStudentCounts(cohorts);
  assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 10_000);
  assert.equal(counts.size, cohorts.length);
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    const yearCohorts = cohorts.filter((cohort) => cohort.year === year);
    const yearTotal = yearCohorts
      .reduce((sum, cohort) => sum + counts.get(cohort.cohortId)!, 0);
    assert.equal(yearTotal, 430 + Math.round((year - FIRST_YEAR) * 140 / (LAST_YEAR - FIRST_YEAR)));
    assert.equal(yearCohorts.filter((cohort) => cohort.level === "ug").length, DEPARTMENTS.length);
    assert.equal(yearCohorts.filter((cohort) => cohort.level === "pg").length, PG_BRANCHES.reduce((sum, branch) => sum + branch.specializations.length, 0));
    for (const branch of PG_BRANCHES) {
      for (const specialization of branch.specializations) {
        assert.ok(yearCohorts.some((cohort) => cohort.dept === branch.code && cohort.specialization === specialization));
      }
    }
  }
  for (const dept of ALL_DEPARTMENTS) {
    const total = cohorts.filter((cohort) => cohort.dept === dept.code)
      .reduce((sum, cohort) => sum + counts.get(cohort.cohortId)!, 0);
    assert.ok(total > 0);
  }
  assert.ok(cohorts.every((cohort) => counts.get(cohort.cohortId)! > 0));

  const cycles = new Map(Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, index) => [FIRST_YEAR + index, randomUUID()]));
  const generated = generateStudents(cohorts, cycles, new Map(), createRng(2027), counts);
  assert.equal(generated.studentRows.length, 10_000);
  assert.equal(new Set(generated.enrollmentRows.map((row) => row.rollNumber)).size, 10_000);
  assert.ok(generated.enrollmentRows.every((row) => row.rollNumber >= 100000000 && row.rollNumber <= 999999999));
});
