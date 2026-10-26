/**
 * Real PostgreSQL acceptance tests. Requires an explicitly isolated database:
 * IMPORT_TEST_DATABASE_URL=postgres://.../tnp_import_test_... node --import tsx --test lib/import/database.integration.test.ts
 * Apply the committed migrations and approved fixture catalogues before running.
 * Never falls back to DATABASE_URL; never drops, truncates or resets a database.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Module from "node:module";
import path from "node:path";
import test, { after, before } from "node:test";
import postgres from "postgres";
import type { CurrentUser, DepartmentRef } from "@/lib/auth/dal";
import type { ImportKind } from "./templates";

const testUrl = process.env.IMPORT_TEST_DATABASE_URL;
if (!testUrl || !/^tnp_import_test_[a-z0-9_]+$/.test(new URL(testUrl).pathname.slice(1))) {
  throw new Error("IMPORT_TEST_DATABASE_URL must explicitly name a tnp_import_test_* database. No default database is permitted.");
}
process.env.DATABASE_URL = testUrl;
const sql = postgres(testUrl, { max: 2, connect_timeout: 5 });
const run = randomUUID().replaceAll("-", "").slice(0, 10);
const baseRoll = 988700000 + Math.floor(Math.random() * 80000);
const cycleCode = `DB-QA-${run}`;
const companyName = `Database Import QA ${run}`;
let actor: CurrentUser;
let scope: DepartmentRef;
let civil: DepartmentRef;
let processImport: typeof import("./process").processImport;
let templateCsv: typeof import("./templates").templateCsv;
let closeAppDatabase: () => Promise<void>;

function csv(kind: ImportKind, rows: string[][]) {
  const escape = (value: string) => /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return templateCsv(kind) + rows.map(row => row.map(escape).join(",")).join("\r\n") + "\r\n";
}
const student = (roll: number, overrides: Record<string, string> = {}) => {
  const row: Record<string, string> = { roll_number: String(roll), student_name: "Database Test Student", department_code: "mme", degree_code: "B.Tech", specialization: "", graduation_year: "2008", admission_year: "2004", gender_code: "", reservation_category_code: "", cycle_code: cycleCode, registration_status: "REGISTERED", ...overrides };
  return templateCsv("students").trim().split(",").map(key => row[key]);
};
const offer = (roll: number, overrides: Record<string, string> = {}) => {
  const row: Record<string, string> = { roll_number: String(roll), cycle_code: cycleCode, company_name: companyName, drive_id: "", role_id: "", package_lpa: "12.500", monthly_stipend_inr: "", offer_type: "FTE", offer_date: "2007-12-01", ...overrides };
  return templateCsv("offers").trim().split(",").map(key => row[key]);
};
async function historyCount() {
  const [row] = await sql`select count(*)::int as count from import_history where actor_id=${actor.id}`;
  return row.count as number;
}
async function preview(kind: ImportKind, contents: string, user = actor, department = scope) {
  return processImport(kind, contents, user, department, false);
}
async function confirm(kind: ImportKind, contents: string) {
  const plan = await preview(kind, contents);
  assert.deepEqual(plan.errors, [], JSON.stringify(plan));
  assert.equal(plan.committed, false);
  const report = await processImport(kind, contents, actor, scope, true, { expectedPlan: plan.planHash });
  assert.deepEqual(report.errors, [], JSON.stringify(report));
  assert.equal(report.committed, true);
  return report;
}

before(async () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  ({ processImport } = require("./process") as typeof import("./process"));
  ({ templateCsv } = require("./templates") as typeof import("./templates"));
  const { postgresClient } = require("@/db") as typeof import("@/db");
  /* eslint-enable @typescript-eslint/no-require-imports */
  closeAppDatabase = async () => { await postgresClient.end(); };
  await sql`insert into departments(code,name) values ('mme','Metallurgical and Materials Engineering'),('civil','Civil Engineering') on conflict(code) do nothing`;
  await sql`insert into degrees(code,level) values ('B.Tech','UG'),('M.Tech','PG') on conflict(code) do nothing`;
  await sql`insert into programmes(department_id,degree_id,specialization) select d.department_id,g.degree_id,null from departments d cross join degrees g where d.code in ('mme','civil') and g.code='B.Tech' on conflict do nothing`;
  await sql`insert into programmes(department_id,degree_id,specialization) select d.department_id,g.degree_id,'Materials Engineering' from departments d cross join degrees g where d.code='mme' and g.code='M.Tech' on conflict do nothing`;
  await sql`insert into cohorts(programme_id,graduation_year) select p.programme_id,y from programmes p cross join (values(2008),(2027)) years(y) on conflict do nothing`;
  const departments = await sql`select department_id as "departmentId",code,name from departments where code in ('mme','civil')`;
  scope = departments.find(row => row.code === "mme") as DepartmentRef;
  civil = departments.find(row => row.code === "civil") as DepartmentRef;
  assert.ok(scope && civil, "Fixture catalogues require mme and civil departments.");
  const [user] = await sql`insert into users(name,email,role,department_id) values('Database Import QA',${`db-qa-${run}@nitt.edu`},'ADMIN',${scope.departmentId}) returning id,name,email,role`;
  actor = { ...user, department: scope } as CurrentUser;
});
after(async () => {
  await sql.end();
  await closeAppDatabase?.();
});

test("valid company preview has zero persistent effects; confirmation records exact values and history", async () => {
  const contents = csv("companies", [[`  ${companyName}  `, "Historical manufacturing", "Fictional test fixture"]]);
  const beforeHistory = await historyCount();
  const report = await preview("companies", contents);
  assert.deepEqual(report.errors, []);
  assert.equal(report.inserted, 1);
  assert.equal(report.committed, false);
  assert.equal((await sql`select company_id from companies where name=${companyName}`).length, 0);
  assert.equal(await historyCount(), beforeHistory);
  await confirm("companies", contents);
  const [stored] = await sql`select name,domain,remarks,hr_name,pvr_status from companies where name=${companyName}`;
  assert.deepEqual(stored, { name: companyName, domain: "Historical manufacturing", remarks: "Fictional test fixture", hr_name: null, pvr_status: null });
  assert.equal(await historyCount(), beforeHistory + 1);
});

test("existing companies update explicitly; exact replay skips without duplicating master rows", async () => {
  await sql`update companies set hr_name='Preserved legacy contact',pvr_status=true where name=${companyName}`;
  const contents = csv("companies", [[companyName, "Updated description", "Reviewed update"]]);
  assert.equal((await confirm("companies", contents)).updated, 1);
  assert.equal((await confirm("companies", contents)).skipped, 1);
  const records = await sql`select hr_name,pvr_status,domain from companies where name=${companyName}`;
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], { hr_name: "Preserved legacy contact", pvr_status: true, domain: "Updated description" });
});

test("malformed headers, extra and missing columns reject before any company writes", async () => {
  for (const contents of ["name,description,remarks\nUnexpected,,", "company_name,description\nUnexpected,", "company_name,description,remarks\nUnexpected,,,extra"]) {
    const report = await preview("companies", contents);
    assert.ok(report.errors.length);
    assert.equal(report.committed, false);
  }
  assert.equal((await sql`select company_id from companies where name='Unexpected'`).length, 0);
});

test("duplicate file keys roll back earlier valid rows and do not create history", async () => {
  const name = `Duplicate QA ${run}`;
  const count = await historyCount();
  const contents = csv("companies", [[name, "", ""], [` ${name} `, "", ""]]);
  const report = await processImport("companies", contents, actor, scope, true, { expectedPlan: "invalid" });
  assert.ok(report.errors.length);
  assert.equal(report.committed, false);
  assert.equal((await sql`select company_id from companies where name=${name}`).length, 0);
  assert.equal(await historyCount(), count);
});

test("cohorts template matches an approved programme and creates only the requested historical year", async () => {
  const contents = csv("cohorts", [["mme", "B.Tech", "", "1998"]]);
  const plan = await preview("cohorts", contents);
  assert.deepEqual(plan.errors, []);
  const report = await confirm("cohorts", contents);
  assert.equal(report.inserted + report.skipped, 1);
  assert.equal((await confirm("cohorts", contents)).skipped, 1);
  const rows = await sql`select c.cohort_id from cohorts c join programmes p using(programme_id) join degrees g using(degree_id) join departments d using(department_id) where d.code='mme' and g.code='B.Tech' and p.specialization is null and c.graduation_year=1998`;
  assert.equal(rows.length, 1);
  assert.ok((await preview("cohorts", csv("cohorts", [["mme", "Invented degree", "", "1997"]]))).errors.length);
});

test("historical cycles and students persist with explicit years and NULL demographics", async () => {
  await confirm("cycles", csv("cycles", [[cycleCode, "2007-08-01", "2008-06-30"]]));
  const contents = csv("students", [student(baseRoll), student(baseRoll + 1, { student_name: "Database Other Student", registration_status: "UNREGISTERED" })]);
  const beforeHistory = await historyCount();
  const plan = await preview("students", contents);
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.inserted, 2);
  assert.equal((await sql`select enrollment_id from enrollments where roll_number in (${baseRoll},${baseRoll + 1})`).length, 0);
  assert.equal(await historyCount(), beforeHistory);
  await confirm("students", contents);
  const rows = await sql`select e.roll_number,e.admission_year,s.gender_code,e.reservation_category_code,c.graduation_year,sc.registration_status,pc.code from enrollments e join students s using(student_id) join cohorts c using(cohort_id) join student_cycles sc using(enrollment_id) join placement_cycles pc using(cycle_id) where e.roll_number in (${baseRoll},${baseRoll + 1}) order by e.roll_number`;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].graduation_year, 2008);
  assert.equal(rows[0].admission_year, 2004);
  assert.equal(rows[0].gender_code, null);
  assert.equal(rows[0].reservation_category_code, null);
  assert.equal(rows[0].code, cycleCode);
  assert.equal(rows[1].registration_status, "UNREGISTERED");
});

test("unknown foreign references and invalid academic values reject whole student files", async () => {
  const invalidFields: Record<string, string>[] = [
    { department_code: "civil" }, { department_code: "unknown" }, { degree_code: "Invented Degree" },
    { specialization: "Unapproved programme" }, { graduation_year: "27" }, { graduation_year: "9999" },
    { gender_code: "Invented" }, { reservation_category_code: "Invented" }, { cycle_code: "Unknown cycle" },
    { registration_status: "" }, { student_name: "Name 123" }, { admission_year: "2009" },
    { degree_code: "M.Tech", specialization: "" },
  ];
  for (const overrides of invalidFields) {
    const contents = csv("students", [student(baseRoll + 2), student(baseRoll + 3, overrides)]);
    const report = await preview("students", contents);
    assert.ok(report.errors.length, JSON.stringify(overrides));
    assert.equal(report.committed, false);
    assert.equal((await sql`select enrollment_id from enrollments where roll_number in (${baseRoll + 2},${baseRoll + 3})`).length, 0);
  }
});

test("normal imports preserve absent historical rows and reject existing academic identity changes", async () => {
  await confirm("students", csv("students", [student(baseRoll + 4, { student_name: "Later Historical Student", graduation_year: "2027", admission_year: "2023" })]));
  assert.equal((await sql`select enrollment_id from enrollments where roll_number in (${baseRoll},${baseRoll + 1},${baseRoll + 4})`).length, 3);
  const report = await preview("students", csv("students", [student(baseRoll, { graduation_year: "2027" })]));
  assert.ok(report.errors.length);
  const [year] = await sql`select c.graduation_year from enrollments e join cohorts c using(cohort_id) where e.roll_number=${baseRoll}`;
  assert.equal(year.graduation_year, 2008);
});

test("offers require known company, registered participation and exact drive/role context", async () => {
  for (const row of [
    offer(baseRoll, { company_name: "Missing Company" }),
    offer(baseRoll + 1),
    offer(baseRoll, { cycle_code: "Missing cycle" }),
    offer(baseRoll, { drive_id: randomUUID() }),
    offer(baseRoll, { role_id: randomUUID() }),
    offer(baseRoll, { package_lpa: "-1" }),
    offer(baseRoll, { offer_date: "2008-02-30" }),
  ]) {
    const report = await preview("offers", csv("offers", [row]));
    assert.ok(report.errors.length, JSON.stringify(row));
  }
  const contents = csv("offers", [offer(baseRoll)]);
  assert.equal((await confirm("offers", contents)).inserted, 1);
  assert.equal((await confirm("offers", contents)).skipped, 1);
  const rows = await sql`select o.package_lpa::text,o.monthly_stipend_inr,o.offer_type,o.offer_date::text,o.drive_id,o.role_id from placement_offers o join enrollments e using(enrollment_id) where e.roll_number=${baseRoll}`;
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].package_lpa), 12.5);
  assert.equal(rows[0].monthly_stipend_inr, null);
  assert.equal(rows[0].drive_id, null);
  assert.equal(rows[0].role_id, null);
  assert.equal(rows[0].offer_date, "2007-12-01");
  const conflict = await preview("offers", csv("offers", [offer(baseRoll, { package_lpa: "20" })]));
  assert.ok(conflict.errors.length);
  const unregistration = await preview("students", csv("students", [student(baseRoll, { registration_status: "UNREGISTERED" })]));
  assert.ok(unregistration.errors.length);
});

test("one final offer per enrollment holds across cycles and valid drive/role FKs persist", async () => {
  const secondCycle = `${cycleCode}-SECOND`;
  await confirm("cycles", csv("cycles", [[secondCycle, "", ""]]));
  await confirm("students", csv("students", [student(baseRoll, { cycle_code: secondCycle })]));
  assert.ok((await preview("offers", csv("offers", [offer(baseRoll, { cycle_code: secondCycle })]))).errors.length);
  const [company] = await sql`select company_id from companies where name=${companyName}`;
  const [cycle] = await sql`select cycle_id from placement_cycles where code=${cycleCode}`;
  const [drive] = await sql`insert into drives(company_id,cycle_id,hr_name,hr_email,hr_phone_number) values(${company.company_id},${cycle.cycle_id},'Fictional Contact','fixture@example.invalid','0000000000') returning drive_id`;
  const [otherDrive] = await sql`insert into drives(company_id,cycle_id,hr_name,hr_email,hr_phone_number) values(${company.company_id},${cycle.cycle_id},'Fictional Contact','fixture@example.invalid','0000000000') returning drive_id`;
  const [role] = await sql`insert into drive_roles(drive_id,job_title,domain) values(${drive.drive_id},'Fixture Engineer','Production') returning role_id`;
  assert.ok((await preview("offers", csv("offers", [offer(baseRoll + 4, { drive_id: otherDrive.drive_id, role_id: role.role_id })]))).errors.length);
  await confirm("offers", csv("offers", [offer(baseRoll + 4, { drive_id: drive.drive_id, role_id: role.role_id })]));
  const [stored] = await sql`select o.drive_id,o.role_id from placement_offers o join enrollments e using(enrollment_id) where e.roll_number=${baseRoll + 4}`;
  assert.equal(stored.drive_id, drive.drive_id);
  assert.equal(stored.role_id, role.role_id);
});

test("service rejects professors, unknown users, forged role and mismatched department", async () => {
  const contents = csv("companies", [[`Unauthorized QA ${run}`, "", ""]]);
  const [professor] = await sql`insert into users(email,role,department_id) values(${`db-prof-${run}@nitt.edu`},'PROFESSOR',${scope.departmentId}) returning id`;
  for (const [user, department] of [
    [{ ...actor, id: professor.id, role: "ADMIN" as const }, scope],
    [{ ...actor, id: randomUUID() }, scope],
    [actor, civil],
    [actor, { ...scope, departmentId: civil.departmentId }],
  ] as [CurrentUser, DepartmentRef][]) {
    const report = await preview("companies", contents, user, department);
    assert.ok(report.errors.length);
    assert.equal(report.committed, false);
  }
  assert.equal((await sql`select company_id from companies where name=${`Unauthorized QA ${run}`}`).length, 0);
});

test("role revoked after preview rejects confirmation using authoritative database role", async () => {
  const contents = csv("companies", [[`Revoked QA ${run}`, "", ""]]);
  const plan = await preview("companies", contents);
  assert.deepEqual(plan.errors, []);
  await sql`update users set role='PROFESSOR' where id=${actor.id}`;
  try {
    const report = await processImport("companies", contents, actor, scope, true, { expectedPlan: plan.planHash });
    assert.ok(report.errors.length);
    assert.equal(report.committed, false);
  } finally {
    await sql`update users set role='ADMIN' where id=${actor.id}`;
  }
  assert.equal((await sql`select company_id from companies where name=${`Revoked QA ${run}`}`).length, 0);
});

test("changed database state invalidates confirmation rather than applying an unreviewed update", async () => {
  const contents = csv("companies", [[companyName, "Approved upcoming update", "Reviewed"]]);
  const plan = await preview("companies", contents);
  assert.deepEqual(plan.errors, []);
  await sql`update companies set domain='Concurrent change' where name=${companyName}`;
  const count = await historyCount();
  const report = await processImport("companies", contents, actor, scope, true, { expectedPlan: plan.planHash });
  assert.ok(report.errors.length);
  assert.equal(report.committed, false);
  assert.equal(await historyCount(), count);
  const [company] = await sql`select domain from companies where name=${companyName}`;
  assert.equal(company.domain, "Concurrent change");
});

test("a deferred PostgreSQL failure rolls back all records and import history", async () => {
  const name = `Commit Failure QA ${run}`;
  const functionName = `import_failure_${run}`;
  const triggerName = `import_failure_trigger_${run}`;
  await sql.unsafe(`create function ${functionName}() returns trigger language plpgsql as $$ begin if NEW.name = '${name}' then raise exception 'Intentional isolated test commit failure'; end if; return NEW; end $$`);
  await sql.unsafe(`create constraint trigger ${triggerName} after insert on companies deferrable initially deferred for each row execute function ${functionName}()`);
  try {
    const contents = csv("companies", [[`Before Failure QA ${run}`, "", ""], [name, "", ""]]);
    const plan = await preview("companies", contents);
    assert.deepEqual(plan.errors, [], "Preview rolls back before deferred commit checks.");
    const count = await historyCount();
    const report = await processImport("companies", contents, actor, scope, true, { expectedPlan: plan.planHash });
    assert.ok(report.errors.length);
    assert.equal(report.committed, false);
    assert.equal((await sql`select company_id from companies where name in (${name},${`Before Failure QA ${run}`})`).length, 0);
    assert.equal(await historyCount(), count);
  } finally {
    await sql.unsafe(`drop trigger ${triggerName} on companies`);
    await sql.unsafe(`drop function ${functionName}()`);
  }
});

test("new roll across multiple explicit cycles has a stable preview plan and one person/enrollment", async () => {
  const contents = csv("students", [student(baseRoll + 5), student(baseRoll + 5, { cycle_code: `${cycleCode}-SECOND` })]);
  const report = await confirm("students", contents);
  assert.equal(report.inserted, 2);
  const [counts] = await sql`select count(distinct e.enrollment_id)::int as enrollments,count(distinct e.student_id)::int as people,count(sc.cycle_id)::int as participations from enrollments e join student_cycles sc using(enrollment_id) where e.roll_number=${baseRoll + 5}`;
  assert.deepEqual(counts, { enrollments: 1, people: 1, participations: 2 });
});

test("concurrent duplicate confirmations commit exactly one master row", async () => {
  const name = `Concurrent Company QA ${run}`;
  const contents = csv("companies", [[name, "", ""]]);
  const plan = await preview("companies", contents);
  assert.deepEqual(plan.errors, []);
  const reports = await Promise.all([
    processImport("companies", contents, actor, scope, true, { expectedPlan: plan.planHash }),
    processImport("companies", contents, actor, scope, true, { expectedPlan: plan.planHash }),
  ]);
  assert.equal(reports.filter(report => report.committed).length, 1);
  assert.equal(reports.filter(report => report.errors.length).length, 1);
  assert.equal((await sql`select company_id from companies where name=${name}`).length, 1);
});

test("concurrent offer and unregistration imports preserve registration/offer compatibility", async () => {
  const offerContents = csv("offers", [offer(baseRoll + 5)]);
  const studentContents = csv("students", [student(baseRoll + 5, { registration_status: "UNREGISTERED" })]);
  const offerPlan = await preview("offers", offerContents);
  const studentPlan = await preview("students", studentContents);
  assert.deepEqual(offerPlan.errors, []);
  assert.deepEqual(studentPlan.errors, []);
  const reports = await Promise.all([
    processImport("offers", offerContents, actor, scope, true, { expectedPlan: offerPlan.planHash }),
    processImport("students", studentContents, actor, scope, true, { expectedPlan: studentPlan.planHash }),
  ]);
  assert.equal(reports.filter(report => report.committed).length, 1);
  const [state] = await sql`select sc.registration_status, o.offer_id from enrollments e join student_cycles sc using(enrollment_id) join placement_cycles pc using(cycle_id) left join placement_offers o on o.enrollment_id=e.enrollment_id and o.cycle_id=sc.cycle_id where e.roll_number=${baseRoll + 5} and pc.code=${cycleCode}`;
  assert.ok(state.registration_status === "REGISTERED" || state.offer_id === null);
});

test("import confirmation and the actual student editor share enrollment locking", async () => {
  // Server-only modules can be exercised outside Next with its own no-op build marker.
  const loader = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
  const resolveFilename = loader._resolveFilename;
  const serverOnly = path.join(path.dirname(require.resolve("next/package.json")), "dist/compiled/server-only/empty.js");
  loader._resolveFilename = function (this: unknown, request, ...rest) {
    return request === "server-only" ? serverOnly : resolveFilename.call(this, request, ...rest);
  };
  let editor: typeof import("@/lib/students/store");
  let reader: typeof import("@/lib/students/read");
  let connection: typeof import("@/db").db;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    editor = require("@/lib/students/store") as typeof editor;
    reader = require("@/lib/students/read") as typeof reader;
    ({ db: connection } = require("@/db") as typeof import("@/db"));
    /* eslint-enable @typescript-eslint/no-require-imports */
  } finally {
    loader._resolveFilename = resolveFilename;
  }
  await confirm("students", csv("students", [student(baseRoll + 6)]));
  const [current] = await reader.readStudents(connection, scope.departmentId, "UG", baseRoll + 6);
  const contents = csv("offers", [offer(baseRoll + 6)]);
  const plan = await preview("offers", contents);
  assert.deepEqual(plan.errors, []);
  const [importResult, editResult] = await Promise.all([
    processImport("offers", contents, actor, scope, true, { expectedPlan: plan.planHash }),
    editor.mutateStudent(scope.departmentId, "UG", "setParticipation", { cycleId: current.participations[0].cycleId, registrationStatus: "UNREGISTERED" }, baseRoll + 6, JSON.stringify(current)),
  ]);
  assert.equal(Number(importResult.committed) + Number(editResult.ok === true), 1);
  const [state] = await sql`select sc.registration_status,o.offer_id from enrollments e join student_cycles sc using(enrollment_id) left join placement_offers o on o.enrollment_id=e.enrollment_id and o.cycle_id=sc.cycle_id where e.roll_number=${baseRoll + 6}`;
  assert.ok(state.registration_status === "REGISTERED" || state.offer_id === null);
});
