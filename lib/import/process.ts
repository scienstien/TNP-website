import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cohorts, companies, cycleCohorts, degrees, departments, driveRoles, drives, enrollments,
  genderTypes, importHistory, placementCycles, placementOffers, programmes,
  reservationCategories, studentCycles, students, users,
} from "@/db/schema";
import type { DepartmentRef, CurrentUser } from "@/lib/auth/dal";
import { parseTemplateCsv, strictDate, decimal, CsvError, type CsvRow } from "./csv";
import type { ImportKind } from "./templates";
import { duplicateKey, normalizeRow, rowProblem } from "./row-rules";
import { mayImport } from "./security";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Outcome = "insert" | "update" | "skip" | "error";
type RowResult = { action: Exclude<Outcome, "error">; key: string; message: string; before?: Record<string, unknown> | null; references?: Record<string, unknown> };
export type ImportPreview = {
  kind: ImportKind; sha256: string; inserted: number; updated: number; skipped: number;
  errors: string[]; rows: { line: number; action: Outcome; key: string; message: string; values: Record<string, string>; before?: Record<string, unknown> | null; references?: Record<string, unknown> }[];
  committed: boolean; previewToken?: string; planHash?: string;
};
class PreviewRollback { constructor(readonly report: ImportPreview) {} }
class RowProblem extends Error {}
const needed = (row: CsvRow, key: string) => {
  const value = row.values[key].trim();
  if (!value) throw new RowProblem(`${key} is required.`);
  return value;
};
const optional = (row: CsvRow, key: string) => row.values[key].trim() || null;
const year = (value: string, field: string) => {
  if (!/^[1-9][0-9]{3}$/.test(value)) throw new RowProblem(`${field} must be a four-digit year.`);
  return Number(value);
};
const date = (value: string | null, field: string) => {
  if (value && !strictDate(value)) throw new RowProblem(`${field} must be a real YYYY-MM-DD date.`);
  return value;
};
const roll = (value: string) => {
  if (!/^[1-9][0-9]{8}$/.test(value)) throw new RowProblem("roll_number must be exactly nine digits without a leading zero.");
  return Number(value);
};
const uuid = (value: string | null, field: string) => {
  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    throw new RowProblem(`${field} must be a UUID or blank.`);
  return value;
};
const name = (value: string) => {
  const result = value.replace(/\s+/gu, " ").normalize("NFC");
  if (Array.from(result).length > 100 || !/\p{L}/u.test(result) || !/^[\p{L}\p{M} .'’-]+$/u.test(result))
    throw new RowProblem("student_name must contain 1–100 letters/spaces/apostrophes/periods/hyphens and no digits.");
  return result;
};
const same = (a: unknown, b: unknown) => a === b;
const companyName = (value: string) => value.replace(/\s+/gu, " ").normalize("NFC");
const normalizeDecimal = (value: string | null) => value === null ? null :
  value.replace(/^0+(?=\d)/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

async function programmeFor(tx: Tx, row: CsvRow, scope: DepartmentRef) {
  if (needed(row, "department_code") !== scope.code) throw new RowProblem(`department_code must be ${scope.code} for the selected department.`);
  const degreeCode = needed(row, "degree_code"), specialization = optional(row, "specialization");
  const [degree] = await tx.select().from(degrees).where(eq(degrees.code, degreeCode)).limit(1);
  if (!degree) throw new RowProblem(`Unknown degree_code ${degreeCode}.`);
  if (degree.level === "PG" && !specialization) throw new RowProblem("PG specialization is required.");
  const options = await tx.select().from(programmes).where(and(eq(programmes.departmentId, scope.departmentId), eq(programmes.degreeId, degree.degreeId)));
  const programme = options.find(item => item.specialization === specialization);
  if (!programme) throw new RowProblem("No confirmed programme matches department_code, degree_code and specialization exactly.");
  return programme;
}

/** One savepoint per row; the surrounding transaction always rolls preview writes back. */
async function writeRow(tx: Tx, kind: ImportKind, row: CsvRow, scope: DepartmentRef): Promise<RowResult> {
  if (kind === "companies") {
    const company = companyName(needed(row, "company_name"));
    const description = optional(row, "description"), remarks = optional(row, "remarks");
    const candidates = await tx.select().from(companies)
      .where(sql`lower(regexp_replace(btrim(${companies.name}), '\\s+', ' ', 'g')) = lower(${company})`).for("update");
    if (candidates.length > 1 || (candidates.length === 1 && candidates[0].name !== company)) throw new RowProblem("Ambiguous or noncanonical company name. Use the exact existing company name from the reference workbook; similar names are never merged or duplicated.");
    const existing = candidates;
    if (existing[0]) {
      const before = { description: existing[0].domain, remarks: existing[0].remarks }, references = { companyId: existing[0].companyId };
      if (same(existing[0].domain, description) && same(existing[0].remarks, remarks)) return { action: "skip", key: company, message: "Unchanged company.", before, references };
      await tx.update(companies).set({ domain: description, remarks }).where(eq(companies.companyId, existing[0].companyId));
      return { action: "update", key: company, message: "Description/remarks updated.", before, references };
    }
    await tx.insert(companies).values({ name: company, domain: description, remarks });
    return { action: "insert", key: company, message: "Company created." };
  }
  if (kind === "cycles") {
    const code = needed(row, "cycle_code");
    const startsOn = date(optional(row, "starts_on"), "starts_on"), endsOn = date(optional(row, "ends_on"), "ends_on");
    if (startsOn && endsOn && startsOn > endsOn) throw new RowProblem("starts_on must be on or before ends_on.");
    const existing = await tx.select().from(placementCycles).where(eq(placementCycles.code, code)).limit(1).for("update");
    if (existing[0]) {
      const before = { starts_on: existing[0].startsOn, ends_on: existing[0].endsOn }, references = { cycleId: existing[0].cycleId };
      if (same(existing[0].startsOn, startsOn) && same(existing[0].endsOn, endsOn)) return { action: "skip", key: code, message: "Unchanged cycle.", before, references };
      await tx.update(placementCycles).set({ startsOn, endsOn }).where(eq(placementCycles.cycleId, existing[0].cycleId));
      return { action: "update", key: code, message: "Cycle dates updated.", before, references };
    }
    await tx.insert(placementCycles).values({ code, startsOn, endsOn });
    return { action: "insert", key: code, message: "Cycle created." };
  }
  if (kind === "cohorts") {
    const programme = await programmeFor(tx, row, scope);
    const graduationYear = year(needed(row, "graduation_year"), "graduation_year");
    const [existing] = await tx.select().from(cohorts).where(and(eq(cohorts.programmeId, programme.programmeId), eq(cohorts.graduationYear, graduationYear))).limit(1);
    const references = { programmeId: programme.programmeId };
    if (existing) return { action: "skip", key: duplicateKey(kind, row), message: "Unchanged cohort.", references };
    await tx.insert(cohorts).values({ programmeId: programme.programmeId, graduationYear });
    return { action: "insert", key: duplicateKey(kind, row), message: "Cohort created for the approved programme.", references };
  }
  if (kind === "students") {
    const rollNumber = roll(needed(row, "roll_number")), studentName = name(needed(row, "student_name"));
    const departmentCode = needed(row, "department_code").toLowerCase();
    if (departmentCode !== scope.code) throw new RowProblem(`department_code must be ${scope.code} for the selected department.`);
    const graduationYear = year(needed(row, "graduation_year"), "graduation_year");
    const admissionYear = optional(row, "admission_year") ? year(needed(row, "admission_year"), "admission_year") : null;
    const genderCode = optional(row, "gender_code"), categoryCode = optional(row, "reservation_category_code");
    const cycleCode = needed(row, "cycle_code"), status = needed(row, "registration_status");
    if (status !== "REGISTERED" && status !== "UNREGISTERED") throw new RowProblem("registration_status must be REGISTERED or UNREGISTERED.");
    const programme = await programmeFor(tx, row, scope);
    const [cycle] = await tx.select().from(placementCycles).where(eq(placementCycles.code, cycleCode)).limit(1);
    if (!cycle) throw new RowProblem(`Unknown cycle_code ${cycleCode}; import cycles first.`);
    if (genderCode && !(await tx.select().from(genderTypes).where(eq(genderTypes.code, genderCode)).limit(1))[0]) throw new RowProblem(`Unknown gender_code ${genderCode}.`);
    if (categoryCode && !(await tx.select().from(reservationCategories).where(eq(reservationCategories.code, categoryCode)).limit(1))[0]) throw new RowProblem(`Unknown reservation_category_code ${categoryCode}.`);
    const [cohort] = await tx.select().from(cohorts).where(and(eq(cohorts.programmeId, programme.programmeId), eq(cohorts.graduationYear, graduationYear))).limit(1);
    if (!cohort) throw new RowProblem("Unknown graduating cohort. Import the confirmed programme/year in the cohorts template first.");
    await tx.insert(cycleCohorts).values({ cycleId: cycle.cycleId, cohortId: cohort.cohortId }).onConflictDoNothing();
    // Use the same enrollment lock as Student Records, serializing offer/registration writes.
    await tx.execute(sql`select 1 from enrollments where roll_number = ${rollNumber} for update`);
    const [existing] = await tx.select({ enrollment: enrollments, student: students }).from(enrollments)
      .innerJoin(students, eq(students.studentId, enrollments.studentId)).where(eq(enrollments.rollNumber, rollNumber)).limit(1);
    let enrollmentId: string;
    if (existing) {
      if (existing.enrollment.cohortId !== cohort.cohortId || existing.student.name !== studentName ||
        existing.student.genderCode !== genderCode || existing.enrollment.admissionYear !== admissionYear ||
        existing.enrollment.reservationCategoryCode !== categoryCode)
        throw new RowProblem("Existing roll has different identity or academic fields; resolve manually. Rolls and cohorts are not overwritten.");
      enrollmentId = existing.enrollment.enrollmentId;
    } else {
      const [person] = await tx.insert(students).values({ name: studentName, genderCode }).returning({ id: students.studentId });
      const [enrollment] = await tx.insert(enrollments).values({ studentId: person.id, rollNumber, cohortId: cohort.cohortId, admissionYear, reservationCategoryCode: categoryCode }).returning({ id: enrollments.enrollmentId });
      enrollmentId = enrollment.id;
    }
    const [participation] = await tx.select().from(studentCycles).where(and(eq(studentCycles.cycleId, cycle.cycleId), eq(studentCycles.enrollmentId, enrollmentId))).limit(1);
    const references = { cohortId: cohort.cohortId, cycleId: cycle.cycleId };
    if (participation) {
      const before = { registration_status: participation.registrationStatus };
      if (participation.registrationStatus === status) return { action: "skip", key: `${rollNumber}/${cycleCode}`, message: "Unchanged registration.", before, references };
      if (status === "UNREGISTERED" && (await tx.select().from(placementOffers).where(eq(placementOffers.enrollmentId, enrollmentId)).limit(1))[0]?.cycleId === cycle.cycleId)
        throw new RowProblem("Cannot unregister a student with a final offer in this cycle.");
      await tx.update(studentCycles).set({ registrationStatus: status }).where(and(eq(studentCycles.cycleId, cycle.cycleId), eq(studentCycles.enrollmentId, enrollmentId)));
      return { action: "update", key: `${rollNumber}/${cycleCode}`, message: "Registration updated.", before, references };
    }
    await tx.insert(studentCycles).values({ cycleId: cycle.cycleId, cohortId: cohort.cohortId, enrollmentId, registrationStatus: status });
    return { action: "insert", key: `${rollNumber}/${cycleCode}`, message: existing ? "Registration added." : "Student and registration created.", references };
  }
  const rollNumber = roll(needed(row, "roll_number")), cycleCode = needed(row, "cycle_code"), company = companyName(needed(row, "company_name"));
  await tx.execute(sql`select 1 from enrollments where roll_number = ${rollNumber} for update`);
  const [enrollment] = await tx.select({ enrollmentId: enrollments.enrollmentId, departmentId: programmes.departmentId }).from(enrollments)
    .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId)).innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
    .where(eq(enrollments.rollNumber, rollNumber)).limit(1);
  if (!enrollment || enrollment.departmentId !== scope.departmentId) throw new RowProblem("Unknown roll_number in the selected department; import students first.");
  const [cycle] = await tx.select().from(placementCycles).where(eq(placementCycles.code, cycleCode)).limit(1);
  if (!cycle) throw new RowProblem(`Unknown cycle_code ${cycleCode}.`);
  const [participation] = await tx.select().from(studentCycles).where(and(eq(studentCycles.enrollmentId, enrollment.enrollmentId), eq(studentCycles.cycleId, cycle.cycleId))).limit(1);
  if (!participation || participation.registrationStatus !== "REGISTERED") throw new RowProblem("Offer requires REGISTERED participation in the explicit cycle.");
  const [companyRow] = await tx.select().from(companies).where(eq(companies.name, company)).limit(1);
  if (!companyRow) throw new RowProblem(`Unknown company_name ${company}; import companies first.`);
  const driveId = uuid(optional(row, "drive_id"), "drive_id"), roleId = uuid(optional(row, "role_id"), "role_id");
  if (roleId && !driveId) throw new RowProblem("role_id requires drive_id.");
  if (driveId && !(await tx.select().from(drives).where(and(eq(drives.driveId, driveId), eq(drives.companyId, companyRow.companyId), eq(drives.cycleId, cycle.cycleId))).limit(1))[0])
    throw new RowProblem("drive_id does not belong to this company and cycle.");
  if (roleId && !(await tx.select().from(driveRoles).where(and(eq(driveRoles.roleId, roleId), eq(driveRoles.driveId, driveId!))).limit(1))[0])
    throw new RowProblem("role_id does not belong to drive_id.");
  const rawPackage = optional(row, "package_lpa"), rawStipend = optional(row, "monthly_stipend_inr");
  if (rawPackage && !decimal(rawPackage)) throw new RowProblem("package_lpa must be a nonnegative decimal INR LPA amount.");
  if (rawStipend && !decimal(rawStipend)) throw new RowProblem("monthly_stipend_inr must be a nonnegative decimal INR amount.");
  const packageLpa = normalizeDecimal(rawPackage), monthlyStipendInr = normalizeDecimal(rawStipend);
  const offerType = optional(row, "offer_type");
  if (offerType && !["PPO", "FTE", "FTE+6month"].includes(offerType)) throw new RowProblem("offer_type must be PPO, FTE, FTE+6month, or blank.");
  const offerDate = date(optional(row, "offer_date"), "offer_date");
  const values = { enrollmentId: enrollment.enrollmentId, cycleId: cycle.cycleId, companyId: companyRow.companyId,
    driveId, roleId, packageLpa, monthlyStipendInr, offerType: offerType as "PPO" | "FTE" | "FTE+6month" | null, offerDate };
  const [existing] = await tx.select().from(placementOffers).where(eq(placementOffers.enrollmentId, enrollment.enrollmentId)).limit(1);
  const references = { enrollmentId: enrollment.enrollmentId, cycleId: cycle.cycleId, companyId: companyRow.companyId, driveId, roleId };
  if (existing) {
    if (existing.cycleId !== cycle.cycleId) throw new RowProblem("Roll already has a final offer in another cycle; resolve conflicting source offers manually.");
    if (existing.companyId === values.companyId && existing.driveId === driveId && existing.roleId === roleId &&
      normalizeDecimal(existing.packageLpa) === packageLpa && normalizeDecimal(existing.monthlyStipendInr) === monthlyStipendInr &&
      existing.offerType === offerType && existing.offerDate === offerDate)
      return { action: "skip", key: String(rollNumber), message: "Unchanged final offer.", references };
    throw new RowProblem("Roll already has a different final offer; review manually before replacing it.");
  }
  await tx.insert(placementOffers).values(values);
  return { action: "insert", key: String(rollNumber), message: "Final offer created.", references };
}

export type ImportOptions = { expectedPlan?: string; fileSha256?: string };

/** Internal service: HTTP also authenticates, but no caller can bypass these DB checks. */
export async function processImport(kind: ImportKind, csv: string, user: CurrentUser, scope: DepartmentRef, confirm: boolean, options: ImportOptions = {}): Promise<ImportPreview> {
  const sha256 = options.fileSha256 ?? createHash("sha256").update(csv).digest("hex");
  const report: ImportPreview = { kind, sha256, inserted: 0, updated: 0, skipped: 0, errors: [], rows: [], committed: false };
  if (!user || !scope || !mayImport(user.role, scope.departmentId) || (user.role === "ADMIN" && user.department?.departmentId !== scope.departmentId)) {
    report.errors.push("Administrator access to the selected department is required.");
    return report;
  }
  let rows: CsvRow[];
  try { rows = parseTemplateCsv(kind, csv).map(normalizeRow); }
  catch (error) { report.errors.push(error instanceof CsvError ? error.message : "Invalid template."); return report; }
  if (!rows.length) { report.errors.push("Template has no data rows."); return report; }
  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(sql`set local statement_timeout = '30s'`);
      // Hold authorization rows through commit so concurrent revocation cannot race the write.
      const [actor] = await tx.select().from(users).where(eq(users.id, user.id)).limit(1).for("share");
      const [department] = await tx.select().from(departments).where(eq(departments.departmentId, scope.departmentId)).limit(1).for("share");
      if (!actor || !department || department.code !== scope.code || !mayImport(actor.role, department.departmentId) ||
          (actor.role === "ADMIN" && actor.departmentId !== department.departmentId) ||
          (actor.role === "SUPERADMIN" && actor.departmentId !== null)) {
        report.errors.push("Administrator authorization changed or the selected department is invalid. Sign in and preview again.");
        throw new PreviewRollback(report);
      }
      const seen = new Set<string>();
      for (const row of rows) {
        const key = duplicateKey(kind, row);
        try {
          if (seen.has(key)) throw new RowProblem(`Duplicate ${kind} key ${key} in this file.`);
          seen.add(key);
          const problem = rowProblem(kind, row);
          if (problem) throw new RowProblem(problem);
          // A rejected row cannot leave tentative links/rows visible to later preview rows.
          const outcome = await tx.transaction(savepoint => writeRow(savepoint, kind, row, scope));
          report.rows.push({ line: row.line, values: row.values, ...outcome });
          if (outcome.action === "insert") report.inserted++;
          else if (outcome.action === "update") report.updated++;
          else report.skipped++;
        } catch (error) {
          const cause = error as { code?: string; cause?: { code?: string } };
          const code = cause.code ?? cause.cause?.code;
          const message = error instanceof RowProblem ? error.message :
            code === "23505" ? "Duplicate record conflicts with a database unique key. Refresh the preview." :
            code === "23503" ? "A referenced record is missing or changed. Refresh the reference workbook and preview." :
            code === "23514" ? "A value violates a database constraint." :
            "Database constraint or transaction error. Nothing will be saved; retry the preview.";
          report.errors.push(`Line ${row.line}: ${message}`);
          report.rows.push({ line: row.line, action: "error", key, message, values: row.values });
          if (code === "40001" || code === "40P01" || code === "57014" || code === "55P03") break;
        }
      }
      report.planHash = createHash("sha256").update(JSON.stringify({ kind, sha256, rows: report.rows })).digest("hex");
      if (report.errors.length || !confirm) throw new PreviewRollback(report);
      if (!options.expectedPlan || options.expectedPlan !== report.planHash) {
        report.errors.push("The import plan changed or was not reviewed. No records were saved. Validate and preview again before confirming.");
        throw new PreviewRollback(report);
      }
      await tx.insert(importHistory).values({ actorId: actor.id, departmentId: department.departmentId, dataset: kind,
        fileSha256: sha256, inserted: report.inserted, updated: report.updated, skipped: report.skipped });
      return report;
    }, { isolationLevel: "serializable" });
    // Only mark committed after PostgreSQL has completed COMMIT (including deferred checks).
    result.committed = true;
    return result;
  } catch (error) {
    if (error instanceof PreviewRollback) return error.report;
    report.committed = false;
    report.errors.push("Import transaction failed; no records were saved. Check database constraints and retry the preview.");
    return report;
  }
}
