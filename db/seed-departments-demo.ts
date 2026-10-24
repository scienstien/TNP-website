/**
 * FICTIONAL multi-department dataset for the department-scoped dashboard.
 *
 * Fills the institute-wide schema (db/schema.ts): the nine B.Tech departments, B.Tech and M.Tech programmes,
 * twenty graduating batches, placement cycles, companies, drives, roles, events, enrollments
 * and final offers, plus a few outreach contacts per department. Every company, student and roll
 * number is invented: companies use the "DEMO" prefix and roll numbers start with 9. The shared
 * definitions live in db/demo-data.ts.
 *
 * It only runs on a database the operator names as disposable (see db/seed-safety.ts): set
 * DEMO_SEED_RESET_DATABASE to the exact database name. It refuses with NODE_ENV=production and on
 * any database holding preserved legacy (historical) rows, and it decides before its first write.
 * Re-running replaces every placement and academic row in that database. It never deletes, moves
 * or creates user accounts, never renames existing departments and never deletes outreach records;
 * the development accounts (superadmin, admin123<dept>@nitt.edu) are created on the first sign-in
 * request, see lib/auth/dev-accounts.ts. For a database with legacy rows, use the add-only
 * db/seed-departments-topup.ts instead.
 *
 *   DEMO_SEED_RESET_DATABASE=<database name> npm run db:seed:departments
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import {
  addDays, CATEGORIES, COMPANIES, createRng, cycleCode, DEPARTMENTS, demoOutreachRows, FIRST_YEAR, GENDERS,
  generateStudents, insertAll, LAST_YEAR, MTECH_FIRST_YEAR, MTECH_SPECIALIZATION, ROLE_DOMAINS, ROLE_TITLES,
  type DemoCohort, type DemoRole, type DeptCode, type Tx,
} from "./demo-data";
import { db, postgresClient } from "./index";
import {
  cohorts,
  companies,
  cycleCohorts,
  degrees,
  departments,
  driveEvents,
  driveRoles,
  drives,
  enrollments,
  eventRoles,
  genderTypes,
  outreachContacts,
  placementCycles,
  placementOffers,
  programmes,
  reservationCategories,
  studentCycles,
  students,
} from "./schema";
import {
  canRemoveRetiredDepartment,
  DEMO_RESET_TABLES,
  LEGACY_TABLES,
  planDemoSeed,
  RESET_DATABASE_ENV,
  type SeedSnapshot,
} from "./seed-safety";

/** Placeholder departments from earlier migrations that must not appear in the demo (none now: mme is a real department). */
const RETIRED_DEPARTMENTS: string[] = [];

const rng = createRng(2027);
const { random, pick, between } = rng;

/** Reads what the safety gate needs. Read-only; runs inside the seed's transaction. */
async function readSnapshot(tx: Tx): Promise<SeedSnapshot> {
  const [{ database }] = await tx.execute<{ database: string }>(sql`select current_database() as database`);
  const rows: Record<string, number> = {};
  for (const table of [...DEMO_RESET_TABLES, ...LEGACY_TABLES]) {
    const [{ present }] = await tx.execute<{ present: boolean }>(sql`select to_regclass(${table}) is not null as present`);
    if (!present) {
      // Only the legacy tables may be absent (a database created after they were retired).
      if ((LEGACY_TABLES as readonly string[]).includes(table)) rows[table] = 0;
      continue;
    }
    const [{ count }] = await tx.execute<{ count: number }>(sql.raw(`select count(*)::int as count from ${table}`));
    rows[table] = count;
  }
  return { database, rows };
}

async function seed() {
  await db.transaction(async (tx) => {
    // Decide before the first write; a refusal throws, so nothing is changed.
    const plan = planDemoSeed(await readSnapshot(tx), {
      resetDatabase: process.env[RESET_DATABASE_ENV],
      nodeEnv: process.env.NODE_ENV,
    });
    if (plan.refuse !== undefined) throw new Error(plan.refuse);

    // The operator confirmed this database is disposable: replace its placement and academic
    // rows, children first. Departments, users and outreach records are kept.
    if (plan.mode === "reset") {
      for (const table of DEMO_RESET_TABLES) {
        await tx.execute(sql.raw(`delete from ${table}`));
      }
    }

    // Reference data.
    await tx.insert(genderTypes).values(GENDERS.map(([code, label]) => ({ code, label }))).onConflictDoNothing();
    await tx.insert(reservationCategories).values(CATEGORIES.map(([code, label]) => ({ code, label }))).onConflictDoNothing();
    await tx.insert(degrees).values([{ code: "B.Tech", level: "UG" }, { code: "M.Tech", level: "PG" }]).onConflictDoNothing();
    const degreeRows = await tx.select().from(degrees);
    const btech = degreeRows.find((row) => row.code === "B.Tech")!;
    const mtech = degreeRows.find((row) => row.code === "M.Tech")!;

    // Existing departments keep their names; user accounts depend on them.
    for (const dept of DEPARTMENTS) {
      await tx.insert(departments).values({ code: dept.code, name: dept.name }).onConflictDoNothing({ target: departments.code });
    }
    // Retired placeholders are removed only when nothing refers to them; accounts and outreach
    // records are never deleted or moved to another department to make that possible.
    for (const code of RETIRED_DEPARTMENTS) {
      const [old] = await tx.select().from(departments).where(eq(departments.code, code));
      if (!old) continue;
      const [references] = await tx.execute<{ users: number; outreachContacts: number; programmes: number }>(sql`
        select
          (select count(*)::int from users where department_id = ${old.departmentId}) as "users",
          (select count(*)::int from outreach_contacts where department_id = ${old.departmentId}) as "outreachContacts",
          (select count(*)::int from programmes where department_id = ${old.departmentId}) as "programmes"`);
      if (canRemoveRetiredDepartment(references)) {
        await tx.delete(departments).where(eq(departments.departmentId, old.departmentId));
      } else {
        console.log(`Kept department "${code}": it still has users, outreach records or programmes.`);
      }
    }
    const departmentRows = await tx.select().from(departments);
    const departmentId = (code: DeptCode) => departmentRows.find((row) => row.code === code)!.departmentId;

    // Programmes, cohorts and placement cycles (one cycle per graduating year).
    const programmeIds = new Map<string, string>(); // `${code}:ug|pg`
    const programmeRows: (typeof programmes.$inferInsert)[] = [];
    for (const dept of DEPARTMENTS) {
      for (const level of ["ug", "pg"] as const) {
        const programmeId = randomUUID();
        programmeIds.set(`${dept.code}:${level}`, programmeId);
        programmeRows.push({
          programmeId,
          departmentId: departmentId(dept.code),
          degreeId: level === "ug" ? btech.degreeId : mtech.degreeId,
          specialization: level === "ug" ? null : MTECH_SPECIALIZATION[dept.code],
        });
      }
    }
    await insertAll(tx, programmes, programmeRows);

    const years = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, index) => FIRST_YEAR + index);
    const cycleIds = new Map<number, string>(years.map((year) => [year, randomUUID()]));
    await insertAll(tx, placementCycles, years.map((year) => ({
      cycleId: cycleIds.get(year)!, code: cycleCode(year), startsOn: `${year - 1}-07-01`, endsOn: `${year}-06-30`,
    })));

    const cohortList: DemoCohort[] = [];
    for (const dept of DEPARTMENTS) {
      for (const year of years) {
        for (const level of ["ug", "pg"] as const) {
          if (level === "pg" && year < MTECH_FIRST_YEAR) continue;
          cohortList.push({ cohortId: randomUUID(), dept: dept.code, level, year });
        }
      }
    }
    await insertAll(tx, cohorts, cohortList.map((cohort) => ({
      cohortId: cohort.cohortId,
      programmeId: programmeIds.get(`${cohort.dept}:${cohort.level}`)!,
      graduationYear: cohort.year,
    })));
    await insertAll(tx, cycleCohorts, cohortList.map((cohort) => ({
      cycleId: cycleIds.get(cohort.year)!, cohortId: cohort.cohortId,
    })));

    // Companies. domain is only a description; hr_name/email/phone_number are legacy global contacts.
    const companyIds = new Map<string, string>();
    await insertAll(tx, companies, COMPANIES.map(([name, sector], index) => {
      const companyId = randomUUID();
      companyIds.set(name, companyId);
      const slug = name.toLowerCase().replace(/[^a-z]+/g, "");
      return {
        companyId,
        name,
        domain: sector,
        hrName: `HR ${name.replace("DEMO ", "")}`,
        email: `hr@${slug}.example.com`,
        phoneNumber: `+91 98000 ${String(10000 + index * 7)}`,
        pvrStatus: random() < 0.5 ? null : random() < 0.5,
      };
    }));

    // Drives, roles and events, per cycle. A company's drive can serve any department.
    const rolesByCycle = new Map<number, DemoRole[]>();
    const driveRows: (typeof drives.$inferInsert)[] = [];
    const roleRows: (typeof driveRoles.$inferInsert)[] = [];
    const eventRows: (typeof driveEvents.$inferInsert)[] = [];
    const eventRoleRows: (typeof eventRoles.$inferInsert)[] = [];
    for (const year of years) {
      const cycleId = cycleIds.get(year)!;
      const roles: DemoRole[] = [];
      for (const [name, , hires, range] of COMPANIES) {
        if (random() > 0.8) continue;
        const companyId = companyIds.get(name)!;
        const driveId = randomUUID();
        const slug = name.toLowerCase().replace(/[^a-z]+/g, "");
        driveRows.push({
          driveId, companyId, cycleId, reference: `${name.replace("DEMO ", "").replace(/\W+/g, "-")}-${cycleCode(year)}`,
          hrName: `Recruiter ${name.replace("DEMO ", "")} ${cycleCode(year)}`, hrEmail: `campus${year}@${slug}.example.com`, hrPhoneNumber: `+91 97000 ${String(10000 + (year % 100) * 13)}`,
        });
        const pptDate = addDays(`${year - 1}-08-01`, between(0, 140));
        eventRows.push(
          { eventId: randomUUID(), driveId, processType: "PPT", scheduledDate: pptDate, scope: "WHOLE_DRIVE" },
          { eventId: randomUUID(), driveId, processType: "OT", scheduledDate: addDays(pptDate, between(2, 6)), scope: "WHOLE_DRIVE" },
        );
        const driveRoleIds: string[] = [];
        for (let r = 0; r < between(1, 2); r++) {
          const typeRoll = random();
          const offerType = typeRoll < 0.2 ? "PPO" : typeRoll < 0.45 ? "FTE+6month" : "FTE";
          const roleId = randomUUID();
          driveRoleIds.push(roleId);
          const jobTitle = pick(ROLE_TITLES);
          roleRows.push({ roleId, driveId, jobTitle, domain: ROLE_DOMAINS[jobTitle] });
          roles.push({ roleId, driveId, companyId, hires: [...hires], offerType, pptDate, range });
        }
        // The interview round is held for the first role only, to exercise role-scoped events.
        const piEvent = randomUUID();
        const piScope = driveRoleIds.length > 1 ? "SELECTED_ROLES" : "WHOLE_DRIVE";
        eventRows.push({ eventId: piEvent, driveId, processType: "PI", scheduledDate: addDays(pptDate, between(8, 20)), scope: piScope });
        if (piScope === "SELECTED_ROLES") eventRoleRows.push({ eventId: piEvent, roleId: driveRoleIds[0], driveId });
      }
      rolesByCycle.set(year, roles);
    }
    await insertAll(tx, drives, driveRows);
    await insertAll(tx, driveRoles, roleRows);
    await insertAll(tx, driveEvents, eventRows);
    await insertAll(tx, eventRoles, eventRoleRows);

    // Students, enrollments, per-cycle registration and final offers.
    const { studentRows, enrollmentRows, cycleRows, offerRows } = generateStudents(cohortList, cycleIds, rolesByCycle, rng);
    await insertAll(tx, students, studentRows);
    await insertAll(tx, enrollments, enrollmentRows);
    await insertAll(tx, studentCycles, cycleRows);
    await insertAll(tx, placementOffers, offerRows);

    // Outreach records are never deleted; a re-run only adds the demo names a department lacks.
    for (const dept of DEPARTMENTS) {
      const existing = new Set((await tx.select({ companyName: outreachContacts.companyName }).from(outreachContacts)
        .where(eq(outreachContacts.departmentId, departmentId(dept.code)))).map((row) => row.companyName));
      const rows = demoOutreachRows(departmentId(dept.code), dept.code, existing);
      if (rows.length) await tx.insert(outreachContacts).values(rows);
    }

    console.log(`${plan.mode === "reset" ? "Replaced the demo data in" : "Seeded"} "${process.env[RESET_DATABASE_ENV]}": ${DEPARTMENTS.length} departments, ${cohortList.length} cohorts, ${studentRows.length} students and ${offerRows.length} offers (all fictional).`);
  });
}

async function main() {
  try {
    await seed();
  } catch (error) {
    console.error("Failed to seed the department demo data.", error);
    process.exitCode = 1;
  } finally {
    await postgresClient.end();
  }
}

void main();
