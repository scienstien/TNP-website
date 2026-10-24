/**
 * ADD-ONLY demo top-up: adds the db/demo-data.ts departments a database is missing, with
 * FICTIONAL B.Tech/M.Tech programmes, cohorts, students, registration and final offers.
 *
 * Use it where the full demo seed refuses (for example a database holding preserved legacy
 * rows). It never deletes or updates anything and never reads or writes legacy_* tables. A
 * department is topped up only when it is missing or has no programmes yet (e.g. the 'mme'
 * department created by migration 0005); departments with data are left exactly as they are.
 * New students join the existing placement cycles and receive offers for roles of the
 * existing DEMO companies' drives that hire from their department; no cycle, company, drive
 * or role is created.
 *
 *   DEMO_TOPUP_DATABASE=<database name> npx tsx db/seed-departments-topup.ts
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { inArray, sql } from "drizzle-orm";

import {
  CATEGORIES, COMPANIES, createRng, cycleCode, DEPARTMENTS, demoOutreachRows, FIRST_YEAR, GENDERS, generateStudents,
  insertAll, LAST_YEAR, MTECH_FIRST_YEAR, MTECH_SPECIALIZATION, type DemoCohort, type DemoRole, type DeptCode,
} from "./demo-data";
import { db, postgresClient } from "./index";
import {
  cohorts, cycleCohorts, degrees, departments, enrollments, genderTypes, outreachContacts, placementCycles,
  placementOffers, programmes, reservationCategories, studentCycles, students,
} from "./schema";
import { planDemoTopUp, TOPUP_DATABASE_ENV } from "./seed-safety";

const rng = createRng(2028);

async function topUp() {
  await db.transaction(async (tx) => {
    const [{ database }] = await tx.execute<{ database: string }>(sql`select current_database() as database`);
    const plan = planDemoTopUp(database, { topUpDatabase: process.env[TOPUP_DATABASE_ENV], nodeEnv: process.env.NODE_ENV });
    if (plan.refuse !== undefined) throw new Error(plan.refuse);

    // Departments that are missing or have no programmes yet.
    const existing = await tx.execute<{ code: string; programmes: number }>(sql`
      select d.code, count(p.programme_id)::int as programmes
      from departments d left join programmes p on p.department_id = d.department_id group by d.code`);
    const withData = new Set(existing.filter((row) => row.programmes > 0).map((row) => row.code));
    const targets = DEPARTMENTS.filter((dept) => !withData.has(dept.code));
    if (!targets.length) {
      console.log(`"${database}" already has data for all ${DEPARTMENTS.length} departments. Nothing was added.`);
      return;
    }

    // Reference rows the demo needs; existing rows are kept as they are.
    await tx.insert(genderTypes).values(GENDERS.map(([code, label]) => ({ code, label }))).onConflictDoNothing();
    await tx.insert(reservationCategories).values(CATEGORIES.map(([code, label]) => ({ code, label }))).onConflictDoNothing();
    await tx.insert(degrees).values([{ code: "B.Tech", level: "UG" }, { code: "M.Tech", level: "PG" }]).onConflictDoNothing();
    const degreeRows = await tx.select().from(degrees);
    const btech = degreeRows.find((row) => row.code === "B.Tech")!;
    const mtech = degreeRows.find((row) => row.code === "M.Tech")!;

    // Existing department rows (and their names) are kept; only missing ones are inserted.
    for (const dept of targets) {
      await tx.insert(departments).values({ code: dept.code, name: dept.name }).onConflictDoNothing({ target: departments.code });
    }
    const departmentRows = await tx.select().from(departments).where(inArray(departments.code, targets.map((dept) => dept.code)));
    const departmentId = (code: DeptCode) => departmentRows.find((row) => row.code === code)!.departmentId;

    // Only the existing demo cycles are joined; none is created or inferred.
    const years = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, index) => FIRST_YEAR + index);
    const cycleRowsByCode = await tx.select().from(placementCycles).where(inArray(placementCycles.code, years.map(cycleCode)));
    const cycleIds = new Map<number, string>();
    for (const year of years) {
      const cycle = cycleRowsByCode.find((row) => row.code === cycleCode(year));
      if (cycle) cycleIds.set(year, cycle.cycleId);
    }
    if (!cycleIds.size) throw new Error(`"${database}" has none of the demo placement cycles (${cycleCode(FIRST_YEAR)} to ${cycleCode(LAST_YEAR)}); run the full demo seed on a disposable database instead.`);

    const programmeIds = new Map<string, string>();
    const programmeRows: (typeof programmes.$inferInsert)[] = [];
    for (const dept of targets) {
      for (const level of ["ug", "pg"] as const) {
        const programmeId = randomUUID();
        programmeIds.set(`${dept.code}:${level}`, programmeId);
        programmeRows.push({ programmeId, departmentId: departmentId(dept.code), degreeId: level === "ug" ? btech.degreeId : mtech.degreeId, specialization: level === "ug" ? null : MTECH_SPECIALIZATION[dept.code] });
      }
    }
    const cohortList: DemoCohort[] = [];
    for (const dept of targets) {
      for (const year of cycleIds.keys()) {
        for (const level of ["ug", "pg"] as const) {
          if (level === "pg" && year < MTECH_FIRST_YEAR) continue;
          cohortList.push({ cohortId: randomUUID(), dept: dept.code, level, year });
        }
      }
    }

    // Roles of existing DEMO company drives, per cycle, with the company's hiring departments.
    const hiring = new Map(COMPANIES.map(([name, , hires, range]) => [name, { hires, range }]));
    const roleRows = await tx.execute<{ roleId: string; driveId: string; companyId: string; companyName: string; cycleCode: string; pptDate: string | null }>(sql`
      select dr.role_id as "roleId", d.drive_id as "driveId", d.company_id as "companyId", c.name as "companyName", pc.code as "cycleCode",
        (select min(e.scheduled_date)::text from drive_events e where e.drive_id = d.drive_id and e.process_type = 'PPT') as "pptDate"
      from drive_roles dr
      join drives d on d.drive_id = dr.drive_id
      join companies c on c.company_id = d.company_id
      join placement_cycles pc on pc.cycle_id = d.cycle_id
      order by pc.code, c.name, dr.role_id`);
    const rolesByCycle = new Map<number, DemoRole[]>();
    for (const year of cycleIds.keys()) {
      const roles: DemoRole[] = [];
      for (const row of roleRows.filter((role) => role.cycleCode === cycleCode(year))) {
        const company = hiring.get(row.companyName);
        if (!company) continue; // Companies outside the demo list are never used.
        const typeRoll = rng.random();
        roles.push({
          roleId: row.roleId, driveId: row.driveId, companyId: row.companyId, hires: company.hires, range: company.range,
          offerType: typeRoll < 0.2 ? "PPO" : typeRoll < 0.45 ? "FTE+6month" : "FTE", pptDate: row.pptDate ?? `${year - 1}-09-01`,
        });
      }
      rolesByCycle.set(year, roles);
    }

    const { studentRows, enrollmentRows, cycleRows, offerRows } = generateStudents(cohortList, cycleIds, rolesByCycle, rng);
    // Roll numbers are globally unique; stop before writing anything that would collide.
    const rolls = enrollmentRows.map((row) => row.rollNumber);
    for (let i = 0; i < rolls.length; i += 1000) {
      const [{ taken }] = await tx.execute<{ taken: number }>(sql`select count(*)::int as taken from enrollments where roll_number in (${sql.join(rolls.slice(i, i + 1000).map((roll) => sql`${roll}`), sql`, `)})`);
      if (taken > 0) throw new Error("Some generated roll numbers already exist. Nothing was added.");
    }

    await insertAll(tx, programmes, programmeRows);
    await insertAll(tx, cohorts, cohortList.map((cohort) => ({ cohortId: cohort.cohortId, programmeId: programmeIds.get(`${cohort.dept}:${cohort.level}`)!, graduationYear: cohort.year })));
    await insertAll(tx, cycleCohorts, cohortList.map((cohort) => ({ cycleId: cycleIds.get(cohort.year)!, cohortId: cohort.cohortId })));
    await insertAll(tx, students, studentRows);
    await insertAll(tx, enrollments, enrollmentRows);
    await insertAll(tx, studentCycles, cycleRows);
    await insertAll(tx, placementOffers, offerRows);

    for (const dept of targets) {
      const names = new Set((await tx.select({ companyName: outreachContacts.companyName }).from(outreachContacts)
        .where(inArray(outreachContacts.departmentId, [departmentId(dept.code)]))).map((row) => row.companyName));
      const rows = demoOutreachRows(departmentId(dept.code), dept.code, names);
      if (rows.length) await tx.insert(outreachContacts).values(rows);
    }

    console.log(`Added to "${database}": ${targets.map((dept) => dept.code).join(", ")} with ${cohortList.length} cohorts, ${studentRows.length} students and ${offerRows.length} offers (all fictional). Nothing existing was changed.`);
  });
}

async function main() {
  try {
    await topUp();
  } catch (error) {
    console.error("Failed to add the demo departments.", error);
    process.exitCode = 1;
  } finally {
    await postgresClient.end();
  }
}

void main();
