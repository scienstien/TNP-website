import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { offerForParticipation, placementRecordsScope } from "./query-conditions";

const dialect = new PgDialect();

test("department users keep UG and authorized-department query scoping", () => {
  const query = dialect.sqlToQuery(placementRecordsScope("department-a"));

  assert.match(query.sql, /"degrees"\."level" = \$1/);
  assert.match(query.sql, /"departments"\."department_id" = \$2/);
  assert.deepEqual(query.params, ["UG", "department-a"]);
});

test("all-department superadmin queries remain limited to UG records", () => {
  const query = dialect.sqlToQuery(placementRecordsScope(null));

  assert.match(query.sql, /"degrees"\."level" = \$1/);
  assert.doesNotMatch(query.sql, /"departments"\."department_id"/);
  assert.deepEqual(query.params, ["UG"]);
});

test("PG queries are explicitly limited to PG records", () => {
  const query = dialect.sqlToQuery(placementRecordsScope(null, "PG"));
  assert.match(query.sql, /"degrees"\."level" = \$1/);
  assert.deepEqual(query.params, ["PG"]);
});

test("offers join to participation by enrollment and owning cycle", () => {
  const query = dialect.sqlToQuery(offerForParticipation());

  assert.match(
    query.sql,
    /"placement_offers"\."enrollment_id" = "student_cycles"\."enrollment_id"/,
  );
  assert.match(
    query.sql,
    /"placement_offers"\."cycle_id" = "student_cycles"\."cycle_id"/,
  );
});
