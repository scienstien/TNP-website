/**
 * FICTIONAL demo dataset definitions shared by db/seed-departments-demo.ts (full reset) and
 * db/seed-departments-topup.ts (add-only). Every company, student and roll number is invented.
 */
import { randomUUID } from "node:crypto";

import type { db } from "./index";
import type { enrollments, placementOffers, studentCycles, students } from "./schema";

// The institute's B.Tech departments. `index` is the single roll-number digit (1-9), so it
// must stay unique and existing departments keep theirs; sizes and placement rates are fictional.
export const DEPARTMENTS = [
  { code: "civil", name: "Civil Engineering", index: 1, size: 56, placed: 0.7 },
  { code: "cse", name: "Computer Science and Engineering", index: 2, size: 70, placed: 0.88 },
  { code: "ece", name: "Electronics and Communication Engineering", index: 3, size: 66, placed: 0.82 },
  { code: "mech", name: "Mechanical Engineering", index: 4, size: 62, placed: 0.74 },
  { code: "chem", name: "Chemical Engineering", index: 5, size: 58, placed: 0.69 },
  { code: "eee", name: "Electrical and Electronics Engineering", index: 6, size: 64, placed: 0.8 },
  { code: "ice", name: "Instrumentation and Control Engineering", index: 7, size: 60, placed: 0.77 },
  { code: "mme", name: "Metallurgical and Materials Engineering", index: 8, size: 58, placed: 0.71 },
  { code: "prod", name: "Production Engineering", index: 9, size: 56, placed: 0.73 },
] as const;
export type DeptCode = (typeof DEPARTMENTS)[number]["code"];
const ALL_DEPTS = DEPARTMENTS.map((dept) => dept.code) as DeptCode[];

export const FIRST_YEAR = 2008;
export const LAST_YEAR = 2027;
export const MTECH_FIRST_YEAR = FIRST_YEAR;

// [name, sector, departments it hires from, package range in LPA]
export const COMPANIES: [string, string, DeptCode[], [number, number]][] = [
  ["DEMO Ferrous Works", "Core: steel", ["civil", "mech", "mme", "prod"], [8, 13]],
  ["DEMO Rolling Mills", "Core: steel", ["civil", "mech", "mme", "prod"], [7, 11]],
  ["DEMO Alloy Smelters", "Core: non-ferrous", ["civil", "mme", "chem"], [9, 15]],
  ["DEMO Mining Corp", "Mining", ["civil", "mech", "mme"], [7, 12]],
  ["DEMO Ceramics Ltd", "Materials", ["civil", "mme", "chem"], [8, 12]],
  ["DEMO Aero Materials", "Aerospace", ["civil", "mech", "mme"], [13, 20]],
  ["DEMO Auto Components", "Manufacturing", ["mech", "civil", "ece", "prod"], [6, 10]],
  ["DEMO Power Systems", "Energy", ["mech", "ece", "eee", "ice"], [9, 14]],
  ["DEMO Materials Research", "R&D", ["civil", "ece", "mme", "chem"], [10, 16]],
  ["DEMO Data Labs", "Analytics", ALL_DEPTS, [11, 18]],
  ["DEMO Software", "IT / Software", ALL_DEPTS, [8, 28]],
  ["DEMO Strategy Partners", "Consulting", ALL_DEPTS, [13, 20]],
  ["DEMO Capital", "Finance", ALL_DEPTS, [15, 26]],
  ["DEMO Cloud Systems", "IT / Software", ["cse", "ece", "eee"], [12, 32]],
  ["DEMO Chip Works", "Semiconductors", ["ece", "cse", "eee", "ice"], [14, 30]],
  ["DEMO Telecom Net", "Telecom", ["ece", "cse", "eee"], [9, 16]],
  ["DEMO Robotics", "Robotics", ["mech", "ece", "cse", "ice", "prod"], [10, 18]],
  ["DEMO Turbines", "Energy", ["mech", "eee"], [8, 14]],
  ["DEMO Infra Build", "Infrastructure", ["mech", "civil"], [6, 10]],
  ["DEMO Cyber Shield", "Security", ["cse"], [12, 24]],
  ["DEMO Game Studio", "Gaming", ["cse"], [10, 22]],
  ["DEMO Embedded Labs", "Embedded", ["ece", "cse", "eee", "ice"], [9, 17]],
  ["DEMO Thermal Tech", "Manufacturing", ["mech", "prod", "chem"], [7, 12]],
  ["DEMO Fintech Pay", "Finance", ["cse", "ece"], [14, 28]],
  ["DEMO Petrochem", "Chemicals", ["chem", "mech", "ice"], [9, 16]],
  ["DEMO Process Controls", "Automation", ["ice", "eee", "chem"], [8, 14]],
];

export const MTECH_SPECIALIZATION: Record<DeptCode, string> = {
  civil: "Structural Engineering",
  cse: "Computer Science",
  ece: "VLSI Design",
  mech: "Thermal Engineering",
  chem: "Chemical Engineering",
  eee: "Power Systems",
  ice: "Process Control and Instrumentation",
  mme: "Materials Science and Engineering",
  prod: "Manufacturing Technology",
};

export const ROLE_TITLES = ["Graduate Engineer", "Software Engineer", "Design Engineer", "Analyst", "Process Engineer"];
// Fictional role domains (drive_roles.domain) used by the domain-wise analytics.
export const ROLE_DOMAINS: Record<string, string> = { "Graduate Engineer": "Core Engineering", "Software Engineer": "Software", "Design Engineer": "Design", Analyst: "Analytics", "Process Engineer": "Production" };
const FIRST = ["Asha", "Bala", "Charu", "Dev", "Esha", "Farid", "Gita", "Hari", "Indu", "Jai", "Kavya", "Lohit", "Mira", "Nikhil", "Ojas", "Priya", "Ravi", "Sana", "Tara", "Uday"];
const LAST = ["Example", "Sample", "Demo", "Test", "Placeholder", "Fictional"];
export const GENDERS: [string, string][] = [["F", "Female"], ["M", "Male"], ["O", "Other"]];
export const CATEGORIES: [string, string][] = [["GEN", "General"], ["OBC", "Other Backward Classes"], ["SC", "Scheduled Caste"], ["ST", "Scheduled Tribe"], ["EWS", "Economically Weaker Section"]];

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
export type Rng = ReturnType<typeof createRng>;
export function createRng(seed: number) {
  const random = mulberry32(seed);
  return {
    random,
    pick: <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)],
    between: (low: number, high: number) => low + Math.floor(random() * (high - low + 1)),
  };
}

export const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
export const addDays = (date: string, days: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
export const cycleCode = (year: number) => `${year - 1}-${String(year).slice(2)}`;

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Inserts in batches so very large statements stay below PostgreSQL's parameter limit. */
export async function insertAll<T extends Parameters<Tx["insert"]>[0]>(tx: Tx, table: T, rows: T["$inferInsert"][], size = 1000) {
  for (let i = 0; i < rows.length; i += size) {
    await tx.insert(table).values(rows.slice(i, i + size));
  }
}

export interface DemoCohort { cohortId: string; dept: DeptCode; level: "ug" | "pg"; year: number }
/** A role a cohort's students can receive an offer for in that cohort's cycle. */
export interface DemoRole { roleId: string; driveId: string; companyId: string; hires: DeptCode[]; offerType: "PPO" | "FTE" | "FTE+6month"; pptDate: string; range: [number, number] }

/** Exactly 10,000 enrollments across 2008-2027, with modest yearly growth and department-sized cohorts. */
export function tenThousandStudentCounts(cohortList: DemoCohort[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    const cohortsForYear = cohortList.filter((cohort) => cohort.year === year);
    if (!cohortsForYear.length) throw new Error(`No demo cohorts for ${year}.`);
    // The symmetric 430-570 progression totals 10,000 over the twenty years.
    const target = 430 + Math.round((year - FIRST_YEAR) * 140 / (LAST_YEAR - FIRST_YEAR));
    const weights = cohortsForYear.map((cohort) =>
      cohort.level === "ug" ? DEPARTMENTS.find((dept) => dept.code === cohort.dept)!.size : 10);
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    const shares = cohortsForYear.map((cohort, index) => {
      const exact = target * weights[index] / weightTotal;
      return { cohort, count: Math.floor(exact), remainder: exact % 1, index };
    });
    const left = target - shares.reduce((sum, share) => sum + share.count, 0);
    shares.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    for (let index = 0; index < left; index++) shares[index].count++;
    for (const share of shares) counts.set(share.cohort.cohortId, share.count);
  }
  if ([...counts.values()].reduce((sum, count) => sum + count, 0) !== 10_000 || counts.size !== cohortList.length)
    throw new Error("The demo cohort allocation must cover exactly 10,000 students.");
  return counts;
}

/** Students, enrollments, per-cycle registration and final offers for the given cohorts. */
export function generateStudents(
  cohortList: DemoCohort[],
  cycleIds: Map<number, string>,
  rolesByCycle: Map<number, DemoRole[]>,
  rng: Rng,
  requestedCounts?: Map<string, number> | number,
) {
  const { random, pick, between } = rng;
  const byCode = new Map<string, (typeof DEPARTMENTS)[number]>(DEPARTMENTS.map((dept) => [dept.code, dept]));
  const studentRows: (typeof students.$inferInsert)[] = [];
  const enrollmentRows: (typeof enrollments.$inferInsert)[] = [];
  const cycleRows: (typeof studentCycles.$inferInsert)[] = [];
  const offerRows: (typeof placementOffers.$inferInsert)[] = [];

  const rawCounts = cohortList.map((cohort) => {
    const dept = byCode.get(cohort.dept)!;
    return cohort.level === "ug" ? dept.size - 6 + (cohort.year % 7) : between(7, 12);
  });

  let counts = rawCounts;
  if (typeof requestedCounts === "number") {
    if (!Number.isSafeInteger(requestedCounts) || requestedCounts < cohortList.length)
      throw new Error("TARGET_STUDENTS must be an integer at least as large as the cohort count.");
    const remaining = requestedCounts - cohortList.length;
    const weightTotal = rawCounts.reduce((sum, count) => sum + count, 0);
    const shares = rawCounts.map((weight, index) => {
      const exact = remaining * weight / weightTotal;
      return { index, count: 1 + Math.floor(exact), remainder: exact % 1 };
    });
    const left = requestedCounts - shares.reduce((sum, share) => sum + share.count, 0);
    shares.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    for (let index = 0; index < left; index++) shares[index].count++;
    counts = shares.sort((a, b) => a.index - b.index).map((share) => share.count);
  } else if (requestedCounts) {
    counts = cohortList.map((cohort) => {
      const count = requestedCounts.get(cohort.cohortId);
      if (!Number.isSafeInteger(count) || count! < 1)
        throw new Error(`Missing or invalid count for demo cohort ${cohort.cohortId}.`);
      return count!;
    });
  }

  for (let cohortIndex = 0; cohortIndex < cohortList.length; cohortIndex++) {
    const cohort = cohortList[cohortIndex];
    const dept = byCode.get(cohort.dept)!;
    const count = counts[cohortIndex];
    const cycleId = cycleIds.get(cohort.year)!;
    const roles = (rolesByCycle.get(cohort.year) ?? []).filter((role) => role.hires.includes(cohort.dept));
    const placedChance = Math.min(0.92, dept.placed * (0.82 + ((cohort.year - FIRST_YEAR) % 5) * 0.05)) * (cohort.level === "pg" ? 0.8 : 1);
    for (let index = 0; index < count; index++) {
      const studentId = randomUUID();
      const enrollmentId = randomUUID();
      const genderRoll = random();
      studentRows.push({
        studentId,
        name: `${pick(FIRST)} ${pick(LAST)}`,
        genderCode: genderRoll < 0.49 ? "F" : genderRoll < 0.98 ? "M" : "O",
      });
      enrollmentRows.push({
        enrollmentId,
        studentId,
        // 9 · department · yy · level · 4-digit serial: nine digits, all in the demo range.
        rollNumber: Number(`9${dept.index}${String(cohort.year % 100).padStart(2, "0")}${cohort.level === "ug" ? 1 : 2}${String(index + 1).padStart(4, "0")}`),
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
  return { studentRows, enrollmentRows, cycleRows, offerRows };
}

/** Outreach rows a department lacks: the last three demo companies hiring from it. */
export function demoOutreachRows(departmentId: string, code: DeptCode, existingNames: Set<string>) {
  return COMPANIES.filter(([, , hires]) => hires.includes(code)).slice(-3)
    .filter(([name]) => !existingNames.has(`${name} (outreach)`))
    .map(([name]) => ({
      departmentId,
      companyName: `${name} (outreach)`,
      hrName: `Outreach ${name.replace("DEMO ", "")}`,
      email: `outreach@${name.toLowerCase().replace(/[^a-z]+/g, "")}.example.com`,
      phoneNumber: "+91 96000 10000",
      pvrStatus: false,
      remarks: "Fictional outreach contact for dashboard demonstration.",
    }));
}
