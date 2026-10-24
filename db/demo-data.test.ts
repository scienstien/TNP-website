import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { DEPARTMENTS, FIRST_YEAR, LAST_YEAR, MTECH_FIRST_YEAR, tenThousandStudentCounts, type DemoCohort } from "./demo-data";

test("10,000 student allocation spans every year and department with proportionate cohorts", () => {
  const cohorts: DemoCohort[] = [];
  for (const dept of DEPARTMENTS) {
    for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
      cohorts.push({ cohortId: randomUUID(), dept: dept.code, level: "ug", year });
      if (year >= MTECH_FIRST_YEAR) cohorts.push({ cohortId: randomUUID(), dept: dept.code, level: "pg", year });
    }
  }
  const counts = tenThousandStudentCounts(cohorts);
  assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 10_000);
  assert.equal(counts.size, cohorts.length);
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    const yearCohorts = cohorts.filter((cohort) => cohort.year === year);
    const yearTotal = yearCohorts
      .reduce((sum, cohort) => sum + counts.get(cohort.cohortId)!, 0);
    assert.equal(yearTotal, 430 + Math.round((year - FIRST_YEAR) * 140 / (LAST_YEAR - FIRST_YEAR)));
    assert.equal(yearCohorts.filter((cohort) => cohort.level === "ug").length, DEPARTMENTS.length);
    assert.equal(yearCohorts.filter((cohort) => cohort.level === "pg").length, DEPARTMENTS.length);
  }
  for (const dept of DEPARTMENTS) {
    const total = cohorts.filter((cohort) => cohort.dept === dept.code)
      .reduce((sum, cohort) => sum + counts.get(cohort.cohortId)!, 0);
    assert.ok(total > 0);
  }
  assert.ok(cohorts.every((cohort) => counts.get(cohort.cohortId)! > 0));
});
