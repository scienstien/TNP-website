/**
 * FICTIONAL multi-department dataset for the department-scoped dashboard.
 *
 * Fills the institute-wide schema (db/schema.ts): four departments, B.Tech and M.Tech programmes,
 * twenty graduating batches, placement cycles, companies, drives, roles, events, enrollments
 * and final offers, plus a few outreach contacts per department. Every company, student and roll
 * number is invented: companies use the "DEMO" prefix and roll numbers start with 9.
 *
 * It only runs on a database the operator names as disposable (see db/seed-safety.ts): set
 * DEMO_SEED_RESET_DATABASE to the exact database name. It refuses with NODE_ENV=production and on
 * any database holding preserved legacy (historical) rows, and it decides before its first write.
 * Re-running replaces every placement and academic row in that database. It never deletes, moves
 * or creates user accounts, never renames existing departments and never deletes outreach records;
 * the development accounts (superadmin, admin123<dept>@nitt.edu) are created on the first sign-in
 * request, see lib/auth/dev-accounts.ts.
 *
 *   DEMO_SEED_RESET_DATABASE=<database name> npm run db:seed:departments
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

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

const DEPARTMENTS = [
  { code: "civil", name: "Civil Engineering", index: 1, size: 56, placed: 0.7 },
  { code: "cse", name: "Computer Science and Engineering", index: 2, size: 70, placed: 0.88 },
  { code: "ece", name: "Electronics and Communication Engineering", index: 3, size: 66, placed: 0.82 },
  { code: "mech", name: "Mechanical Engineering", index: 4, size: 62, placed: 0.74 },
] as const;
type DeptCode = (typeof DEPARTMENTS)[number]["code"];

/** Placeholder departments from earlier migrations that must not appear in the demo. */
const RETIRED_DEPARTMENTS = ["mme"];

const FIRST_YEAR = 2008;
const LAST_YEAR = 2027;
const MTECH_FIRST_YEAR = 2020;

// [name, sector, departments it hires from, package range in LPA]
const COMPANIES: [string, string, DeptCode[], [number, number]][] = [
  ["DEMO Ferrous Works", "Core: steel", ["civil", "mech"], [8, 13]],
  ["DEMO Rolling Mills", "Core: steel", ["civil", "mech"], [7, 11]],
  ["DEMO Alloy Smelters", "Core: non-ferrous", ["civil"], [9, 15]],
  ["DEMO Mining Corp", "Mining", ["civil", "mech"], [7, 12]],
  ["DEMO Ceramics Ltd", "Materials", ["civil"], [8, 12]],
  ["DEMO Aero Materials", "Aerospace", ["civil", "mech"], [13, 20]],
  ["DEMO Auto Components", "Manufacturing", ["mech", "civil", "ece"], [6, 10]],
  ["DEMO Power Systems", "Energy", ["mech", "ece"], [9, 14]],
  ["DEMO Materials Research", "R&D", ["civil", "ece"], [10, 16]],
  ["DEMO Data Labs", "Analytics", ["civil", "cse", "ece", "mech"], [11, 18]],
  ["DEMO Software", "IT / Software", ["civil", "cse", "ece", "mech"], [8, 28]],
  ["DEMO Strategy Partners", "Consulting", ["civil", "cse", "ece", "mech"], [13, 20]],
  ["DEMO Capital", "Finance", ["civil", "cse", "ece", "mech"], [15, 26]],
  ["DEMO Cloud Systems", "IT / Software", ["cse", "ece"], [12, 32]],
  ["DEMO Chip Works", "Semiconductors", ["ece", "cse"], [14, 30]],
  ["DEMO Telecom Net", "Telecom", ["ece", "cse"], [9, 16]],
  ["DEMO Robotics", "Robotics", ["mech", "ece", "cse"], [10, 18]],
  ["DEMO Turbines", "Energy", ["mech"], [8, 14]],
  ["DEMO Infra Build", "Infrastructure", ["mech"], [6, 10]],
  ["DEMO Cyber Shield", "Security", ["cse"], [12, 24]],
  ["DEMO Game Studio", "Gaming", ["cse"], [10, 22]],
  ["DEMO Embedded Labs", "Embedded", ["ece", "cse"], [9, 17]],
  ["DEMO Thermal Tech", "Manufacturing", ["mech"], [7, 12]],
  ["DEMO Fintech Pay", "Finance", ["cse", "ece"], [14, 28]],
];

const MTECH_SPECIALIZATION: Record<DeptCode, string> = {
  civil: "Structural Engineering",
  cse: "Computer Science",
  ece: "VLSI Design",
  mech: "Thermal Engineering",
};

const ROLE_TITLES = ["Graduate Engineer", "Software Engineer", "Design Engineer", "Analyst", "Process Engineer"];
const FIRST = ["Asha", "Bala", "Charu", "Dev", "Esha", "Farid", "Gita", "Hari", "Indu", "Jai", "Kavya", "Lohit", "Mira", "Nikhil", "Ojas", "Priya", "Ravi", "Sana", "Tara", "Uday"];
const LAST = ["Example", "Sample", "Demo", "Test", "Placeholder", "Fictional"];
const GENDERS: [string, string][] = [["F", "Female"], ["M", "Male"], ["O", "Other"]];
const CATEGORIES: [string, string][] = [["GEN", "General"], ["OBC", "Other Backward Classes"], ["SC", "Scheduled Caste"], ["ST", "Scheduled Tribe"], ["EWS", "Economically Weaker Section"]];

/** Small seeded PRNG so the dataset is identical on every machine. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(2027);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
const between = (low: number, high: number) => low + Math.floor(random() * (high - low + 1));

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const addDays = (date: string, days: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const cycleCode = (year: number) => `${year - 1}-${String(year).slice(2)}`;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Inserts in batches so very large statements stay below PostgreSQL's parameter limit. */
async function insertAll<T extends Parameters<Tx["insert"]>[0]>(
  tx: Tx,
  table: T,
  rows: T["$inferInsert"][],
  size = 1000,
) {
  for (let i = 0; i < rows.length; i += size) {
    await tx.insert(table).values(rows.slice(i, i + size));
  }
}

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
    // The original MME placeholder (created by migration 0005) is not part of the demo data. It is
    // removed only when nothing refers to it; accounts and outreach records are never deleted or
    // moved to another department to make that possible.
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

    interface Cohort { cohortId: string; dept: DeptCode; level: "ug" | "pg"; year: number }
    const cohortList: Cohort[] = [];
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

    // Companies (contact details are global company fields).
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
    interface Role { roleId: string; driveId: string; cycleId: string; companyId: string; hires: DeptCode[]; offerType: "PPO" | "FTE" | "FTE+6month"; pptDate: string; range: [number, number] }
    const rolesByCycle = new Map<number, Role[]>();
    const driveRows: (typeof drives.$inferInsert)[] = [];
    const roleRows: (typeof driveRoles.$inferInsert)[] = [];
    const eventRows: (typeof driveEvents.$inferInsert)[] = [];
    const eventRoleRows: (typeof eventRoles.$inferInsert)[] = [];
    for (const year of years) {
      const cycleId = cycleIds.get(year)!;
      const roles: Role[] = [];
      for (const [name, , hires, range] of COMPANIES) {
        if (random() > 0.8) continue;
        const companyId = companyIds.get(name)!;
        const driveId = randomUUID();
        driveRows.push({ driveId, companyId, cycleId, reference: `${name.replace("DEMO ", "").replace(/\W+/g, "-")}-${cycleCode(year)}` });
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
          roleRows.push({ roleId, driveId, jobTitle: pick(ROLE_TITLES) });
          roles.push({ roleId, driveId, cycleId, companyId, hires: [...hires], offerType, pptDate, range });
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
    const deptIndex = new Map<string, number>(DEPARTMENTS.map((dept) => [dept.code, dept.index]));
    const deptPlaced = new Map<string, number>(DEPARTMENTS.map((dept) => [dept.code, dept.placed]));
    const deptSize = new Map<string, number>(DEPARTMENTS.map((dept) => [dept.code, dept.size]));

    const studentRows: (typeof students.$inferInsert)[] = [];
    const enrollmentRows: (typeof enrollments.$inferInsert)[] = [];
    const cycleRows: (typeof studentCycles.$inferInsert)[] = [];
    const offerRows: (typeof placementOffers.$inferInsert)[] = [];
    for (const cohort of cohortList) {
      const count = cohort.level === "ug"
        ? deptSize.get(cohort.dept)! - 6 + (cohort.year % 7)
        : between(7, 12);
      const cycleId = cycleIds.get(cohort.year)!;
      const roles = (rolesByCycle.get(cohort.year) ?? []).filter((role) => role.hires.includes(cohort.dept));
      const placedChance = Math.min(0.92, deptPlaced.get(cohort.dept)! * (0.82 + ((cohort.year - FIRST_YEAR) % 5) * 0.05)) * (cohort.level === "pg" ? 0.8 : 1);
      for (let index = 0; index < count; index++) {
        const studentId = randomUUID();
        const enrollmentId = randomUUID();
        studentRows.push({ studentId, name: `${pick(FIRST)} ${pick(LAST)}`, genderCode: pick(["F", "M", "M", "F", "O"]) });
        enrollmentRows.push({
          enrollmentId,
          studentId,
          // 9 · department · yy · level · 4-digit serial: nine digits, all in the demo range.
          rollNumber: Number(`9${deptIndex.get(cohort.dept)}${String(cohort.year % 100).padStart(2, "0")}${cohort.level === "ug" ? 1 : 2}${String(index + 1).padStart(4, "0")}`),
          cohortId: cohort.cohortId,
          admissionYear: cohort.year - (cohort.level === "ug" ? 4 : 2),
          reservationCategoryCode: pick(["GEN", "GEN", "OBC", "OBC", "SC", "ST", "EWS"]),
        });

        const role = roles.length > 0 && random() < placedChance ? pick(roles) : null;
        const offerDate = role && random() >= 0.08 ? addDays(role.pptDate, between(5, 70)) : null;
        // The current season is still running: offers that would be dated after today do not exist yet.
        const placed = role !== null && !(offerDate && offerDate > today);
        // An offer needs a REGISTERED student-cycle; otherwise some students opt out.
        cycleRows.push({
          cycleId, enrollmentId, cohortId: cohort.cohortId,
          registrationStatus: placed || random() < 0.9 ? "REGISTERED" : "UNREGISTERED",
        });
        if (!placed || !role) continue;
        const [low, high] = role.range;
        offerRows.push({
          enrollmentId, cycleId, companyId: role.companyId, driveId: role.driveId, roleId: role.roleId,
          packageLpa: random() < 0.05 ? null : String(Math.round((low + random() * (high - low)) * (1 + (cohort.year - FIRST_YEAR) * 0.03) * 2) / 2),
          monthlyStipendInr: role.offerType === "FTE+6month" ? String(between(25, 60) * 1000) : null,
          offerType: random() < 0.05 ? null : role.offerType,
          offerDate,
        });
      }
    }
    await insertAll(tx, students, studentRows);
    await insertAll(tx, enrollments, enrollmentRows);
    await insertAll(tx, studentCycles, cycleRows);
    await insertAll(tx, placementOffers, offerRows);

    // Outreach records are never deleted; a re-run only adds the demo names a department lacks.
    for (const dept of DEPARTMENTS) {
      const existing = new Set((await tx.select({ companyName: outreachContacts.companyName }).from(outreachContacts)
        .where(eq(outreachContacts.departmentId, departmentId(dept.code)))).map((row) => row.companyName));
      const rows = COMPANIES.filter(([, , hires]) => hires.includes(dept.code)).slice(-3)
        .filter(([name]) => !existing.has(`${name} (outreach)`))
        .map(([name]) => ({
          departmentId: departmentId(dept.code),
          companyName: `${name} (outreach)`,
          hrName: `Outreach ${name.replace("DEMO ", "")}`,
          email: `outreach@${name.toLowerCase().replace(/[^a-z]+/g, "")}.example.com`,
          pvrStatus: false,
        }));
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
