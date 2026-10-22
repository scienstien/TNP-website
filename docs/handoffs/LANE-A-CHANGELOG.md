# Lane A changelog

- Lane: A (Claude). Owner of `lib/students/**`, `components/students/**`,
  `app/(portal)/students/**`, `db/seed-departments-demo.ts`, `db/seed-safety*.ts`.
- Branch: `lane-a/mig-students-seed`
- Base commit: `5687c05b65a451cf12cb1241e06483712dca6d95` (shared with Lane B)
- Tasks, in order: MIG-001 → MIG-003 → MIG-004
- Per-task handoffs: [MIG-001](MIG-001.md), [MIG-003](MIG-003.md), [MIG-004](MIG-004.md)

Entries are chronological, one per commit. SHAs were backfilled by the final
`docs: backfill Lane A commit SHAs` commit. Every commit also carries `Task:` and
`Lane: A` lines at the end: `git log --grep "Lane: A"`.

| SHA | Task | Subject |
| --- | --- | --- |
| `c23b3b2` | MIG-001 | MIG-001: make student writes target explicit registered participation |
| `fd948e1` | MIG-003 | MIG-003: gate the demo seed on an explicitly disposable database |
| `3ecaa59` | MIG-004 | MIG-004: explicit programme, cycle and registration editing for students |
| _this commit_ | docs | docs: backfill Lane A commit SHAs (plus database verification record) |

## 2026-10-22 · MIG-001 · MIG-001: make student writes target explicit registered participation
- SHA: `c23b3b2`
- Files:
  - `lib/students/rules.ts` (new)
  - `lib/students/rules.test.ts` (new)
  - `lib/students/store.ts`
  - `lib/students/types.ts`
  - `lib/students/validation.ts`
  - `lib/students/validation.test.ts`
  - `components/students/StudentRecords.tsx`
  - `docs/handoffs/MIG-001.md` (new)
  - `docs/handoffs/LANE-A-CHANGELOG.md` (new)
- What and why:
  - Removed the destructive batch move.
  - Offer writes now lock the participations and the offer, target the offer's own
    cycle (or an explicit or single participation), and require REGISTERED.
  - Offers are updated by `offer_id`.
  - Enrollment-only operations no longer need a participation.
  - A rename is rejected when the person also has an enrollment in another department.
- Verify: the student test files (13 passed); lint; `tsc --noEmit`; `next build`.
- Revert: `git revert <SHA>`. MIG-004 builds on `rules.ts` and `writeOffer()`, so revert
  MIG-004 first.

## 2026-10-22 · MIG-003 · MIG-003: gate the demo seed on an explicitly disposable database
- SHA: `fd948e1`
- Files:
  - `db/seed-safety.ts` (new)
  - `db/seed-safety.test.ts` (new)
  - `db/seed-departments-demo.ts`
  - `docs/handoffs/MIG-003.md` (new)
  - `docs/handoffs/LANE-A-CHANGELOG.md`
- What and why:
  - The seed runs only when `DEMO_SEED_RESET_DATABASE` equals `current_database()`, never
    in production, and never next to preserved legacy rows. It decides before its first
    write.
  - It no longer deletes, moves or creates users, never renames departments, and never
    deletes outreach records.
  - It no longer uses roll ranges or name prefixes as provenance.
- Verify: `db/seed-safety.test.ts` (8 passed); `tsc --noEmit`; eslint on the Lane A paths.
- Revert: `git revert <SHA>`. No later Lane A commit depends on it.
- Environment note: `next build` creates an untracked `TNP-website/TNP-website/.next/`
  folder, because Next.js picks `C:\Users\hp\Desktop\tnp dashboard\package-lock.json` as
  the workspace root. Whole-repo `npm run lint` then fails on those generated chunks. The
  agent was not permitted to delete the folder. Delete it manually, or lint the source
  paths. It is untracked and never committed.

## 2026-10-22 · MIG-004 · MIG-004: explicit programme, cycle and registration editing for students
- SHA: `3ecaa59`
- Files:
  - `lib/students/types.ts`
  - `lib/students/validation.ts`
  - `lib/students/validation.test.ts`
  - `lib/students/rules.ts`
  - `lib/students/rules.test.ts`
  - `lib/students/read.ts`
  - `lib/students/queries.ts`
  - `lib/students/store.ts`
  - `lib/students/actions.ts`
  - `lib/students/README.md`
  - `components/students/StudentRecords.tsx`
  - `components/students/students.css`
  - `docs/handoffs/MIG-004.md` (new)
  - `docs/handoffs/LANE-A-CHANGELOG.md`
- What and why:
  - The student contract carries IDs and nested participations.
  - Create uses an explicit programme, a manual admission year and an optional explicit
    registration. No cycle is inferred or created.
  - New registration actions (set, remove) refuse to touch the offer's cycle.
  - Companies are chosen by ID.
  - Cohort moves stay rejected.
- Verify: Lane A tests (27 passed); `tsc --noEmit`; eslint on the Lane A paths; `next build`.
- Revert: `git revert <SHA>` (restores MIG-001 behavior). Revert before MIG-001 if both
  go.

## 2026-10-22 · docs · docs: backfill Lane A commit SHAs
- Files: `docs/handoffs/LANE-A-CHANGELOG.md`, `docs/handoffs/MIG-001.md`,
  `docs/handoffs/MIG-003.md`, `docs/handoffs/MIG-004.md`.
- What and why:
  - Filled in the commit SHAs.
  - Recorded the database verification below and its results in each handoff.
- No code change.

## Database verification (2026-10-22, at `3ecaa59`)

**Isolation.**
- Database: a throwaway `postgres:17-alpine` container named `tnp-lane-a-verify`, on
  `127.0.0.1:55432`, database `tnp_lane_a_verify`.
- Started with `--rm` and no named volume. The developer's `tnp_postgres_data` volume and
  `tnp_dashboard` database were never connected to.
- Migrations `0000`–`0005` were applied with `drizzle-kit migrate`.
- The container was stopped and removed afterwards (`docker stop tnp-lane-a-verify`).
- All data was fictional (the demo seed plus fictional rows the script added).

```powershell
docker run --rm -d --name tnp-lane-a-verify -e POSTGRES_USER=verify -e POSTGRES_PASSWORD=verify `
  -e POSTGRES_DB=tnp_lane_a_verify -p 127.0.0.1:55432:5432 postgres:17-alpine
$env:DATABASE_URL = "postgresql://verify:verify@127.0.0.1:55432/tnp_lane_a_verify"
npx drizzle-kit migrate
```

### Seed (MIG-003): six runs

A fictional `PROFESSOR` user (`prof.fictional@example.edu`) was first inserted in the
`mme` department that migration 0005 creates.

| Run | Environment | Result |
| --- | --- | --- |
| 1 | no `DEMO_SEED_RESET_DATABASE` | Refused ("set DEMO_SEED_RESET_DATABASE=tnp_lane_a_verify …"); 0 enrollments, 1 department after |
| 2 | `DEMO_SEED_RESET_DATABASE=tnp_dashboard` | Refused ("names "tnp_dashboard" but the connection is to "tnp_lane_a_verify""); nothing changed |
| 3 | `=tnp_lane_a_verify` | `fresh`: 5137 students, 3581 offers, 12 outreach rows. Departments civil, cse, ece, mech, mme; `mme` kept because the user refers to it. The user is unchanged |
| 4 | same again | `reset`: identical counts (5137 / 3581 / 12), outreach not duplicated, user and `mme` unchanged |
| 5 | same, plus one `legacy_companies` row | Refused ("holds preserved historical rows (legacy_companies) …"). The row was then deleted from the throwaway database |
| 6 | same, `NODE_ENV=production` | Refused ("never runs with NODE_ENV=production") |

The seed was run as
`node -e "process.geteuid=()=>0; require('tsx/cjs/api').register(); require('./db/seed-departments-demo.ts')"`
(the tsx CLI fails on Windows with Node 24).

### Student persistence (MIG-001 and MIG-004): 16 of 16 passed

The script calls the real `mutateStudent()` and `readStudents()` from `lib/students/` on the
seeded database. `server-only` is resolved to Next's own empty server build inside that one
test process only. Output:

```
PASS  two participations: a second explicit registration is added without touching the offer
PASS  offer edit stays in the offer's cycle; offer_id, drive, role and stipend preserved
PASS  an offer cannot be moved to another cycle
PASS  the offer's cycle cannot become UNREGISTERED or be removed; rows unchanged
PASS  another cycle of the same enrollment can become UNREGISTERED and be removed
PASS  stale snapshot is rejected and nothing changes
PASS  a foreign department cannot read or write the roll
PASS  batch and programme moves are rejected and nothing changes
PASS  create: explicit programme, null admission year, no registration, no cycle created
PASS  zero participation: rename and admission-year edit work; an offer is refused
PASS  UNREGISTERED participation cannot receive an offer
PASS  two participations: a new offer needs an explicit REGISTERED cycle
PASS  rollback: a rejected offer write in the same patch leaves the name unchanged
PASS  concurrency: offer write and unregistration on the same snapshot never leave an offer on UNREGISTERED
PASS  shared person across departments: rename refused, rows unchanged
PASS  readStudents: one record per enrollment, offers not multiplied by participations

16/16 database checks passed
```

"Rows unchanged" compares a JSON snapshot of the enrollment, person name,
`student_cycles` rows and `placement_offers` row before and after the rejected call. After
every check, the script also asserts globally that no offer sits on UNREGISTERED
participation.

**Not covered here** (left to MIG-012):
- the professor, signed-out and "All departments" rejections in `actions.ts`, which need a
  running Next.js server;
- browser UI interaction.

To reproduce, save the two files below outside the repository, start the container and
migrate as above, run the seed with `DEMO_SEED_RESET_DATABASE=tnp_lane_a_verify`, then run
`node <dir>/run-verify.cjs` from the repository root with `DATABASE_URL` set to the
throwaway database.

<details><summary><code>run-verify.cjs</code></summary>

```js
// Test-process-only shim: resolve the "server-only" marker to Next's empty server build, then run
// the Lane A database verification through tsx. Run from the repository root.
process.geteuid = () => 0;
const Module = require("module");
const path = require("path");
const empty = path.resolve("node_modules/next/dist/compiled/server-only/empty.js");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return request === "server-only" ? empty : resolve.call(this, request, ...rest);
};
// Resolve packages from the repository (this script lives in the scratchpad).
Module.createRequire(path.resolve("package.json"))("tsx/cjs/api").register();
require(path.join(__dirname, "verify-lane-a.ts"));
```

</details>

<details><summary><code>verify-lane-a.ts</code> (the 16 checks)</summary>

```ts
/**
 * Lane A database verification against a DISPOSABLE PostgreSQL (never a shared database).
 * Run from the repository root with DATABASE_URL pointing at the throwaway container:
 *   node --conditions=react-server -e "process.geteuid=()=>0; require('tsx/cjs/api').register(); require('<this file>')"
 * Calls the real lib/students persistence (mutateStudent/readStudents) on seeded fictional data.
 */
import assert from "node:assert/strict";
import { postgresClient as sql, db } from "@/db";
import { mutateStudent } from "@/lib/students/store";
import { readStudents } from "@/lib/students/read";
import type { StudentRecord } from "@/lib/students/types";

const results: { name: string; ok: boolean; detail?: string }[] = [];
async function check(name: string, body: () => Promise<void>) {
  try { await body(); results.push({ name, ok: true }); }
  catch (error) { results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) }); }
}

async function dept(code: string) {
  const [row] = await sql<{ department_id: string }[]>`select department_id from departments where code = ${code}`;
  return row.department_id;
}
async function record(departmentId: string, roll: number): Promise<StudentRecord> {
  const [current] = await readStudents(db, departmentId, roll);
  assert.ok(current, `roll ${roll} readable`);
  return current;
}
/** Every row an enrollment owns, for before/after comparisons. */
async function rows(roll: number) {
  const [enrollment] = await sql`select e.*, s.name from enrollments e join students s using (student_id) where roll_number = ${roll}`;
  const cycles = enrollment ? await sql`select * from student_cycles where enrollment_id = ${enrollment.enrollment_id} order by cycle_id` : [];
  const offers = enrollment ? await sql`select * from placement_offers where enrollment_id = ${enrollment.enrollment_id}` : [];
  return JSON.stringify({ enrollment, cycles, offers });
}
async function invariantNoUnregisteredOffer() {
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from placement_offers o
    join student_cycles sc on sc.cycle_id = o.cycle_id and sc.enrollment_id = o.enrollment_id
    where sc.registration_status = 'UNREGISTERED'`;
  assert.equal(count, 0, "no offer may sit on UNREGISTERED participation");
}

async function main() {
  const civil = await dept("civil");
  const cse = await dept("cse");
  // A civil UG student with an offer that has a drive and role, plus a cycle the cohort is not in yet.
  const [placed] = await sql<{ roll_number: number; cycle_id: string; offer_id: string; drive_id: string; role_id: string; cohort_id: string }[]>`
    select e.roll_number, o.cycle_id, o.offer_id, o.drive_id, o.role_id, e.cohort_id
    from placement_offers o join enrollments e using (enrollment_id)
    join cohorts c using (cohort_id) join programmes p using (programme_id) join degrees d using (degree_id)
    where p.department_id = ${civil} and d.level = 'UG' and o.role_id is not null
    order by e.roll_number limit 1`;
  const [otherCycle] = await sql<{ cycle_id: string; code: string }[]>`
    select cycle_id, code from placement_cycles where cycle_id <> ${placed.cycle_id} order by code limit 1`;
  const roll = placed.roll_number;

  await check("two participations: a second explicit registration is added without touching the offer", async () => {
    const before = await record(civil, roll);
    const result = await mutateStudent(civil, "setParticipation", { cycleId: otherCycle.cycle_id, registrationStatus: "REGISTERED" }, roll, JSON.stringify(before));
    assert.deepEqual(result, { ok: true });
    const after = await record(civil, roll);
    assert.equal(after.participations.length, 2);
    assert.equal(after.offer?.offerId, placed.offer_id);
    const [link] = await sql`select 1 from cycle_cohorts where cycle_id = ${otherCycle.cycle_id} and cohort_id = ${placed.cohort_id}`;
    assert.ok(link, "explicit registration associated the cohort with the chosen cycle");
  });

  await check("offer edit stays in the offer's cycle; offer_id, drive, role and stipend preserved", async () => {
    await sql`update placement_offers set monthly_stipend_inr = 45000 where offer_id = ${placed.offer_id}`;
    const before = await record(civil, roll);
    const result = await mutateStudent(civil, "patch", { offer: { packageLpa: "12.5" } }, roll, JSON.stringify(before));
    assert.deepEqual(result, { ok: true });
    const [offer] = await sql`select * from placement_offers where offer_id = ${placed.offer_id}`;
    assert.equal(offer.cycle_id, placed.cycle_id);
    assert.equal(offer.drive_id, placed.drive_id);
    assert.equal(offer.role_id, placed.role_id);
    assert.equal(offer.package_lpa, "12.5");
    assert.equal(offer.monthly_stipend_inr, "45000");
  });

  await check("an offer cannot be moved to another cycle", async () => {
    const before = await record(civil, roll);
    const snapshot = await rows(roll);
    const result = await mutateStudent(civil, "patch", { offer: { cycleId: otherCycle.cycle_id, packageLpa: "1" } }, roll, JSON.stringify(before));
    assert.ok(result.fieldErrors?.offer, JSON.stringify(result));
    assert.equal(await rows(roll), snapshot);
  });

  await check("the offer's cycle cannot become UNREGISTERED or be removed; rows unchanged", async () => {
    const before = await record(civil, roll);
    const snapshot = await rows(roll);
    const unregister = await mutateStudent(civil, "setParticipation", { cycleId: placed.cycle_id, registrationStatus: "UNREGISTERED" }, roll, JSON.stringify(before));
    assert.ok(unregister.fieldErrors?.registrationStatus, JSON.stringify(unregister));
    const removal = await mutateStudent(civil, "removeParticipation", { cycleId: placed.cycle_id }, roll, JSON.stringify(before));
    assert.ok(removal.fieldErrors?.participation, JSON.stringify(removal));
    assert.equal(await rows(roll), snapshot);
  });

  await check("another cycle of the same enrollment can become UNREGISTERED and be removed", async () => {
    let current = await record(civil, roll);
    assert.deepEqual(await mutateStudent(civil, "setParticipation", { cycleId: otherCycle.cycle_id, registrationStatus: "UNREGISTERED" }, roll, JSON.stringify(current)), { ok: true });
    current = await record(civil, roll);
    assert.deepEqual(await mutateStudent(civil, "removeParticipation", { cycleId: otherCycle.cycle_id }, roll, JSON.stringify(current)), { ok: true });
    current = await record(civil, roll);
    assert.equal(current.participations.length, 1);
  });

  await check("stale snapshot is rejected and nothing changes", async () => {
    const stale = await record(civil, roll);
    const fresh = await mutateStudent(civil, "patch", { name: "Fresh Example" }, roll, JSON.stringify(stale));
    assert.deepEqual(fresh, { ok: true });
    const snapshot = await rows(roll);
    const result = await mutateStudent(civil, "patch", { name: "Stale Example" }, roll, JSON.stringify(stale));
    assert.match(result.error ?? "", /changed/);
    assert.equal(await rows(roll), snapshot);
  });

  await check("a foreign department cannot read or write the roll", async () => {
    const current = await record(civil, roll);
    const snapshot = await rows(roll);
    const result = await mutateStudent(cse, "patch", { name: "Foreign Example" }, roll, JSON.stringify(current));
    assert.match(result.error ?? "", /no longer exists/);
    assert.equal((await readStudents(db, cse, roll)).length, 0);
    assert.equal(await rows(roll), snapshot);
  });

  await check("batch and programme moves are rejected and nothing changes", async () => {
    const current = await record(civil, roll);
    const snapshot = await rows(roll);
    const batch = await mutateStudent(civil, "patch", { batchYear: current.batchYear + 1 }, roll, JSON.stringify(current));
    assert.ok(batch.fieldErrors?.batchYear, JSON.stringify(batch));
    const [pg] = await sql`select programme_id from programmes where department_id = ${civil} and programme_id <> ${current.programmeId} limit 1`;
    const programme = await mutateStudent(civil, "patch", { programmeId: pg.programme_id }, roll, JSON.stringify(current));
    assert.ok(programme.fieldErrors?.programmeId, JSON.stringify(programme));
    assert.equal(await rows(roll), snapshot);
  });

  // A new civil student for the remaining scenarios (no participation at first).
  const [{ programme_id: civilUg }] = await sql`select p.programme_id from programmes p join degrees d using (degree_id) where p.department_id = ${civil} and d.level = 'UG'`;
  const newRoll = 812345678;
  const [cycleA, cycleB] = await sql<{ cycle_id: string }[]>`select cycle_id from placement_cycles order by code desc limit 2`;
  const [company] = await sql<{ company_id: string }[]>`select company_id from companies order by name limit 1`;

  await check("create: explicit programme, null admission year, no registration, no cycle created", async () => {
    const [{ count: cyclesBefore }] = await sql`select count(*)::int as count from placement_cycles`;
    const result = await mutateStudent(civil, "create", { rollNumber: String(newRoll), name: "Zero Participation", programmeId: civilUg, batchYear: "2031", admissionYear: "" });
    assert.deepEqual(result, { ok: true });
    const created = await record(civil, newRoll);
    assert.equal(created.admissionYear, null);
    assert.equal(created.participations.length, 0);
    const [{ count: cyclesAfter }] = await sql`select count(*)::int as count from placement_cycles`;
    assert.equal(cyclesAfter, cyclesBefore, "no placement cycle is created");
  });

  await check("zero participation: rename and admission-year edit work; an offer is refused", async () => {
    let current = await record(civil, newRoll);
    assert.deepEqual(await mutateStudent(civil, "patch", { name: "Renamed Example", admissionYear: "2027" }, newRoll, JSON.stringify(current)), { ok: true });
    current = await record(civil, newRoll);
    assert.equal(current.name, "Renamed Example");
    assert.equal(current.admissionYear, 2027);
    const offer = await mutateStudent(civil, "patch", { offer: { companyId: company.company_id } }, newRoll, JSON.stringify(current));
    assert.ok(offer.fieldErrors?.offer, JSON.stringify(offer));
  });

  await check("UNREGISTERED participation cannot receive an offer", async () => {
    let current = await record(civil, newRoll);
    assert.deepEqual(await mutateStudent(civil, "setParticipation", { cycleId: cycleA.cycle_id, registrationStatus: "UNREGISTERED" }, newRoll, JSON.stringify(current)), { ok: true });
    current = await record(civil, newRoll);
    const result = await mutateStudent(civil, "patch", { offer: { companyId: company.company_id } }, newRoll, JSON.stringify(current));
    assert.ok(result.fieldErrors?.offer, JSON.stringify(result));
    await invariantNoUnregisteredOffer();
  });

  await check("two participations: a new offer needs an explicit REGISTERED cycle", async () => {
    let current = await record(civil, newRoll);
    assert.deepEqual(await mutateStudent(civil, "setParticipation", { cycleId: cycleB.cycle_id, registrationStatus: "REGISTERED" }, newRoll, JSON.stringify(current)), { ok: true });
    current = await record(civil, newRoll);
    const ambiguous = await mutateStudent(civil, "patch", { offer: { companyId: company.company_id } }, newRoll, JSON.stringify(current));
    assert.ok(ambiguous.fieldErrors?.offer, JSON.stringify(ambiguous));
    const explicit = await mutateStudent(civil, "patch", { offer: { cycleId: cycleB.cycle_id, companyId: company.company_id, offerDate: null } }, newRoll, JSON.stringify(current));
    assert.deepEqual(explicit, { ok: true });
    current = await record(civil, newRoll);
    assert.equal(current.offer?.cycleId, cycleB.cycle_id);
  });

  await check("rollback: a rejected offer write in the same patch leaves the name unchanged", async () => {
    const current = await record(civil, newRoll);
    const snapshot = await rows(newRoll);
    const result = await mutateStudent(civil, "patch", { name: "Should Roll Back", offer: { cycleId: cycleA.cycle_id } }, newRoll, JSON.stringify(current));
    assert.ok(result.fieldErrors?.offer, JSON.stringify(result));
    assert.equal(await rows(newRoll), snapshot);
  });

  await check("concurrency: offer write and unregistration on the same snapshot never leave an offer on UNREGISTERED", async () => {
    let current = await record(civil, newRoll);
    assert.deepEqual(await mutateStudent(civil, "removeOffer", null, newRoll, JSON.stringify(current)), { ok: true });
    current = await record(civil, newRoll);
    const expected = JSON.stringify(current);
    const outcomes = await Promise.all([
      mutateStudent(civil, "patch", { offer: { cycleId: cycleB.cycle_id, companyId: company.company_id, offerDate: null } }, newRoll, expected),
      mutateStudent(civil, "setParticipation", { cycleId: cycleB.cycle_id, registrationStatus: "UNREGISTERED" }, newRoll, expected),
    ]);
    assert.equal(outcomes.filter((outcome) => outcome.ok).length, 1, JSON.stringify(outcomes));
    await invariantNoUnregisteredOffer();
  });

  await check("shared person across departments: rename refused, rows unchanged", async () => {
    const current = await record(civil, newRoll);
    const [cseCohort] = await sql`select c.cohort_id from cohorts c join programmes p using (programme_id) join degrees d using (degree_id) where p.department_id = ${cse} and d.level = 'UG' limit 1`;
    await sql`insert into enrollments (student_id, roll_number, cohort_id) values (${current.studentId}, 812345679, ${cseCohort.cohort_id})`;
    const snapshot = await rows(newRoll);
    const result = await mutateStudent(civil, "patch", { name: "Cross Department" }, newRoll, JSON.stringify(current));
    assert.ok(result.fieldErrors?.name, JSON.stringify(result));
    assert.equal(await rows(newRoll), snapshot);
  });

  await check("readStudents: one record per enrollment, offers not multiplied by participations", async () => {
    const all = await readStudents(db, civil);
    const [{ count }] = await sql`select count(*)::int as count from enrollments e join cohorts c using (cohort_id) join programmes p using (programme_id) join degrees d using (degree_id) where p.department_id = ${civil} and d.level = 'UG'`;
    assert.equal(all.length, count);
    assert.equal(new Set(all.map((s) => s.enrollmentId)).size, all.length);
  });

  await invariantNoUnregisteredOffer();
  for (const result of results) console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.detail ? `\n      ${result.detail}` : ""}`);
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} database checks passed`);
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => sql.end());
```

</details>

## Pre-PR conflict checks (2026-10-22, Lane A at `2242721`, Lane B at `13c8904`)

- **(a) Lane A paths only:** 19 changed paths since `5687c05`, all inside the Lane A
  allowlist. Not touched: `lib/students/company-validation.ts`, `lib/companies`,
  `lib/calendar`, `lib/placements`, `components/ui`, `components/portal`,
  `TASKS.md`, `AGENTS.md`, `db/README.md`, `db/schema.ts`, `drizzle`,
  `package*.json`.
- **(b) No overlap with Lane B:** Lane B has 45 changed paths; the intersection is empty.
  Lane B's merge base is also `5687c05`. The frozen interfaces Lane A consumes are
  unchanged on Lane B:
  - `visitDatesByCompany(connection, cycleId)` (same signature and query);
  - `todayInInstituteZone` and `isValidIsoDate` (still exported);
  - Lane B's `lib/companies/validation.ts` still imports
    `@/lib/students/company-validation`.
- **(c) Integration dry run** (local branch `tmp/integration-dry-run` from `origin/main`,
  never pushed, deleted afterwards). Both lanes merged with `--no-ff` and **no
  conflicts**. Results:
  - `npx tsc --noEmit` → exit 0;
  - eslint on `app components lib db auth.ts auth.config.ts proxy.ts` → exit 0;
  - `next build` → passed, with every route including `/companies/drives` and
    `/students`;
  - all 12 test files → 86 tests, 84 passed, 2 failed.

  The 2 failures are the pre-existing `lib/placements/year-to-date.test.ts` dynamic-import
  failures under the Windows `tsx/cjs` workaround. They fail identically on `5687c05`;
  neither lane touches `lib/placements`.