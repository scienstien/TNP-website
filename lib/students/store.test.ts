/**
 * Store-level validation gates, run without a database:
 *   node -e "process.geteuid=()=>0; require('tsx/cjs/api').register(); require('./lib/students/store.test.ts')"
 * DATABASE_URL is forced to an unreachable address, so no test can write to a real database.
 */
import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import test, { after } from "node:test";

// Outside Next, map "server-only" to Next's bundled no-op build (as the Lane A verification did).
const loader = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const resolveFilename = loader._resolveFilename;
const serverOnly = path.join(path.dirname(require.resolve("next/package.json")), "dist/compiled/server-only/empty.js");
loader._resolveFilename = function (this: unknown, request, ...rest) {
  return request === "server-only" ? serverOnly : resolveFilename.call(this, request, ...rest);
};
process.env.DATABASE_URL = "postgres://unused@127.0.0.1:1/unused";
/* eslint-disable @typescript-eslint/no-require-imports */
const { mutateStudent } = require("./store") as typeof import("./store");
const { postgresClient } = require("@/db") as typeof import("@/db");
/* eslint-enable @typescript-eslint/no-require-imports */
after(() => postgresClient.end());

const roll = 123456789;
const cycleId = "10000000-0000-4000-8000-000000000001";

test("student writes do not load the company-wide visit/PPT projection", () => {
  const visitModule = require.resolve("@/lib/companies/visit");
  assert.equal(require.cache[visitModule], undefined);
});

test("setParticipation with a valid cycle/status plus an unexpected field is rejected before any write", async () => {
  const result = await mutateStudent("department", "UG", "setParticipation", { cycleId, registrationStatus: "REGISTERED", extra: 1 }, roll, "{}");
  assert.deepEqual(result, { fieldErrors: { form: "Only the placement cycle and registration status can be set." } });
});

test("a valid setParticipation request still passes validation and reaches the transaction", async (t) => {
  t.mock.method(console, "error", () => {});
  const result = await mutateStudent("department", "UG", "setParticipation", { cycleId, registrationStatus: "UNREGISTERED" }, roll, "{}");
  assert.equal(result.fieldErrors, undefined);
  assert.equal(result.error, "Unable to save changes. Please retry.", "only the unreachable test database stops it");
});
