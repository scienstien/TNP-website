/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import test from "node:test";
import Module from "node:module";
import { PgDialect } from "drizzle-orm/pg-core";

// Exercise the real query/read functions with a scripted connection. No database URL or connection.
const loader = Module as unknown as { _load: (...args: any[]) => any };
const original = loader._load;
let responses: unknown[][] = [];
let predicates: { sql: string; params: unknown[] }[] = [];
let denied = false;
const companyId = "10000000-0000-4000-8000-000000000001";
const cycleId = "20000000-0000-4000-8000-000000000001";
const driveId = "30000000-0000-4000-8000-000000000001";
const roleId = "40000000-0000-4000-8000-000000000001";
const tx = { select() {
  const result = responses.shift();
  assert.ok(result, "unexpected query");
  const chain: any = { then: (resolve: any) => Promise.resolve(result).then(resolve) };
  for (const method of ["from", "innerJoin", "leftJoin", "orderBy", "groupBy", "limit"]) chain[method] = () => chain;
  chain.where = (condition: any) => { if (condition) predicates.push(new PgDialect().sqlToQuery(condition)); return chain; };
  return chain;
} };
loader._load = function(request, ...args) {
  if (request === "server-only") return {};
  if (request === "@/db") return { db: { transaction: async (read: any) => read(tx) } };
  if (request === "@/lib/auth/dal") return {
    requireRole: async () => { if (denied) throw Error("Forbidden"); return { role: "ADMIN" }; },
    resolveDepartment: async () => ({ departmentId: "department-A", name: "Civil" }),
  };
  return original.call(this, request, ...args);
};
const { getCompanyOfferDistribution } = require("./offer-distribution") as typeof import("./offer-distribution");
const { getCompanyDriveOptions, getCompanyProcess } = require("./panel-queries") as typeof import("./panel-queries");
const { getCompanyOfferSummaries } = require("./offer-summaries") as typeof import("./offer-summaries");
loader._load = original;

function setup(rows: unknown[][]) { responses = rows; predicates = []; denied = false; }
const drive = { driveId, companyId, cycleId, reference: null, companyName: "Fictional", cycleCode: "26-27" };
const role = { roleId, driveId, jobTitle: null };
const selection = () => [[{ id: companyId }], [{ id: cycleId }]];
const distribution = () => getCompanyOfferDistribution({ companyId, cycleId, dimension: "gender", selectedRoleId: roleId });

test("protected drive options keep nullable and zero-offer roles and scope exact company/cycle", async () => {
  setup([...selection(), [drive], [role, { ...role, roleId: roleId.replace(/1$/, "2") }]]);
  const options = await getCompanyDriveOptions(companyId, cycleId);
  assert.equal(options[0].reference, null);
  assert.equal(options[0].roles.length, 2);
  assert.equal(options[0].roles[0].jobTitle, null);
  assert.deepEqual(predicates[2].params, [companyId, cycleId]);
  assert.equal(responses.length, 0);
});
test("distribution includes selectable zero-offer role and uses REGISTERED department population", async () => {
  setup([...selection(), [], [drive], [role], [{ count: 0 }], [], [{ count: 0 }]]);
  const result = await distribution();
  assert.equal(result.selectedRoleId, roleId);
  assert.equal(result.roleOptions.length, 1);
  assert.equal(result.totalOffers, 0);
  assert.deepEqual(result.buckets, []);
  assert.ok(predicates.some(query => query.params.includes("department-A") && query.params.includes("REGISTERED") && query.params.includes(roleId)));
});
test("distribution rejects a mismatch against independently counted final offers", async () => {
  setup([...selection(), [], [drive], [role], [{ count: 0 }], [{ key: "gender:missing", label: "Not recorded", count: 1 }], [{ count: 2 }]]);
  await assert.rejects(distribution(), /figures don't add up/);
});
test("process rejects a drive from another company/cycle before reading events", async () => {
  setup([...selection(), []]);
  await assert.rejects(getCompanyProcess(companyId, cycleId, driveId), /no longer available/);
  assert.equal(responses.length, 0);
});
test("process reads undated events using drive identity with no date window", async () => {
  setup([...selection(), [drive], [], [{ eventId: "event-1", ...drive, scheduledDate: null }], []]);
  const events = await getCompanyProcess(companyId, cycleId, driveId);
  assert.equal(events[0].scheduledDate, null);
  const condition = predicates.find(query => query.params[0] === driveId && query.params.includes(companyId));
  assert.ok(condition);
  assert.doesNotMatch(condition.sql, /scheduled_date/);
});
test("authorization fails before any placement query", async () => {
  setup([]); denied = true;
  await assert.rejects(getCompanyDriveOptions(companyId, cycleId), /Forbidden/);
  assert.equal(predicates.length, 0);
});

test("runtime payload missing a required cycle cannot broaden the drive read", async () => {
  setup([]);
  await assert.rejects(getCompanyDriveOptions(companyId, undefined as unknown as string), /valid company and placement cycle/);
  assert.equal(responses.length, 0);
});

test("compensation rows keep role identity and missing amounts; offer types include NULL", async () => {
  setup([...selection(), [], [drive], [role, { ...role, roleId: roleId.replace(/1$/, "2") }],
    [{ roleId, offerCount: 2, package: { knownCount: 1, median: "0", minimum: "0", maximum: "0" } }],
    [{ type: null, count: 2 }]]);
  const result = await getCompanyOfferSummaries(companyId, cycleId);
  assert.equal(result.rows.length, 3, "two recorded roles plus No role recorded");
  assert.equal(result.rows[0].package.median, 0, "actual zero is retained");
  assert.equal(result.rows[1].offerCount, 0, "zero-offer role is retained");
  assert.deepEqual(result.types, [{ key: "missing", label: "Not recorded", count: 2 }]);
  assert.equal(result.typeTotal, 2);
});
