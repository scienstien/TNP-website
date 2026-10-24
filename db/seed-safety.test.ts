import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canRemoveRetiredDepartment,
  DEMO_RESET_TABLES,
  LEGACY_TABLES,
  planDemoSeed,
  planDemoTopUp,
  type SeedSnapshot,
} from "./seed-safety";

/** A snapshot of a database whose counted tables are all empty, with optional overrides. */
function snapshot(database: string, rows: Record<string, number> = {}): SeedSnapshot {
  const empty = Object.fromEntries([...DEMO_RESET_TABLES, ...LEGACY_TABLES].map((table) => [table, 0]));
  return { database, rows: { ...empty, ...rows } };
}

// Fixtures named in TASKS.md MIG-003: a valid 9-prefixed non-demo enrollment, a standalone
// person with no enrollment, company-free data, and existing department users (users are not
// part of the snapshot because the seed never touches them).
const nineRollEnrollment = snapshot("tnp_dashboard", { students: 1, enrollments: 1, cohorts: 1, programmes: 1 });
const standalonePerson = snapshot("tnp_dashboard", { students: 1 });
const noCompanies = snapshot("tnp_dashboard", { placement_cycles: 2, programmes: 1, cohorts: 1, companies: 0 });

test("refuses every dataset unless the exact database is confirmed as disposable", () => {
  for (const fixture of [nineRollEnrollment, standalonePerson, noCompanies, snapshot("tnp_dashboard")]) {
    assert.ok(planDemoSeed(fixture, {}).refuse, "no confirmation");
    assert.ok(planDemoSeed(fixture, { resetDatabase: "  " }).refuse, "blank confirmation");
    assert.ok(planDemoSeed(fixture, { resetDatabase: "tnp_demo" }).refuse, "confirmation names another database");
  }
});

test("roll-number ranges and name prefixes are not treated as provenance", () => {
  // A database whose only enrollment starts with 9 is still refused without confirmation.
  const plan = planDemoSeed(nineRollEnrollment, {});
  assert.match(plan.refuse ?? "", /DEMO_SEED_RESET_DATABASE=tnp_dashboard/);
});

test("never runs in production, even when confirmed", () => {
  assert.ok(planDemoSeed(snapshot("tnp_demo"), { resetDatabase: "tnp_demo", nodeEnv: "production" }).refuse);
});

test("refuses any database holding preserved legacy rows, even when confirmed", () => {
  for (const table of LEGACY_TABLES) {
    const plan = planDemoSeed(snapshot("tnp_demo", { [table]: 1 }), { resetDatabase: "tnp_demo" });
    assert.ok(plan.refuse);
    assert.match(plan.refuse!, new RegExp(table));
  }
});

test("refuses when a target table could not be counted", () => {
  const rows = { ...snapshot("tnp_demo").rows } as Record<string, number>;
  delete rows.enrollments;
  assert.ok(planDemoSeed({ database: "tnp_demo", rows }, { resetDatabase: "tnp_demo" }).refuse);
  assert.ok(planDemoSeed(snapshot("tnp_demo", { companies: -1 }), { resetDatabase: "tnp_demo" }).refuse);
});

test("a confirmed empty database is seeded insert-only; a confirmed used one is reset", () => {
  assert.deepEqual(planDemoSeed(snapshot("tnp_demo"), { resetDatabase: "tnp_demo" }), { mode: "fresh" });
  assert.deepEqual(planDemoSeed(snapshot("tnp_demo", { enrollments: 5 }), { resetDatabase: " tnp_demo " }), { mode: "reset" });
});

test("the retired department is removed only when nothing refers to it", () => {
  assert.equal(canRemoveRetiredDepartment({ users: 0, outreachContacts: 0, programmes: 0 }), true);
  assert.equal(canRemoveRetiredDepartment({ users: 1, outreachContacts: 0, programmes: 0 }), false);
  assert.equal(canRemoveRetiredDepartment({ users: 0, outreachContacts: 1, programmes: 0 }), false);
  assert.equal(canRemoveRetiredDepartment({ users: 0, outreachContacts: 0, programmes: 1 }), false);
});

test("the seed never writes user accounts and decides before its first write", () => {
  const source = readFileSync(join(__dirname, "seed-departments-demo.ts"), "utf8");
  assert.doesNotMatch(source, /^\s*users,?\s*$|\{\s*users\s*\}|tx\.(insert|update|delete)\(users\)|(delete from|update|insert into)\s+users\b/m,
    "the demo seed must not import, delete, update or insert users");
  const body = source.slice(source.indexOf("async function seed()"));
  const decision = body.indexOf("planDemoSeed(");
  const firstWrite = body.search(/tx\.(insert|update|delete)\(|delete from/);
  assert.ok(decision > 0 && firstWrite > decision, "planDemoSeed() must run before any write");
});

test("the add-only top-up needs the database named exactly and never runs in production", () => {
  assert.deepEqual(planDemoTopUp("tnp", { topUpDatabase: "tnp" }), {});
  assert.deepEqual(planDemoTopUp("tnp", { topUpDatabase: " tnp " }), {});
  assert.match(planDemoTopUp("tnp", {}).refuse ?? "", /DEMO_TOPUP_DATABASE=tnp/);
  assert.match(planDemoTopUp("tnp", { topUpDatabase: "other" }).refuse ?? "", /Nothing was changed/);
  assert.match(planDemoTopUp("tnp", { topUpDatabase: "tnp", nodeEnv: "production" }).refuse ?? "", /production/);
});
