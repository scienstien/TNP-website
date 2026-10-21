import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cohorts,
  companies,
  cycleCohorts,
  degrees,
  driveRoles,
  drives,
  enrollments,
  placementOffers,
  programmes,
  studentCycles,
  students,
} from "@/db/schema";
import { visitDatesByCompany } from "@/lib/companies/visit";
import { ensureCycleId } from "@/lib/placements/cycles";
import { readStudents, type Transaction } from "./read";
import type { StudentOffer, StudentResult } from "./types";
import { offerDateProblem, rollProblem, validateStudent } from "./validation";

export type Operation = "create" | "patch" | "removeOffer" | "removeStudent";

interface Context {
  departmentId: string;
  enrollmentId: string;
  cohortId: string;
  cycleId: string;
}

/** The department's B.Tech cohort and placement cycle for a graduating year, created if missing. */
async function ensureCohort(tx: Transaction, departmentId: string, batchYear: number) {
  const [programme] = await tx
    .select({ programmeId: programmes.programmeId })
    .from(programmes)
    .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId))
    .where(and(eq(programmes.departmentId, departmentId), eq(degrees.level, "UG")))
    .orderBy(programmes.programmeId)
    .limit(1);
  if (!programme) throw new StudentError("This department has no undergraduate programme.", "form");

  let [cohort] = await tx
    .select({ cohortId: cohorts.cohortId })
    .from(cohorts)
    .where(and(eq(cohorts.programmeId, programme.programmeId), eq(cohorts.graduationYear, batchYear)));
  if (!cohort) {
    [cohort] = await tx
      .insert(cohorts)
      .values({ programmeId: programme.programmeId, graduationYear: batchYear })
      .returning({ cohortId: cohorts.cohortId });
  }
  const cycleId = await ensureCycleId(tx, batchYear);
  await tx.insert(cycleCohorts).values({ cycleId, cohortId: cohort.cohortId }).onConflictDoNothing();
  return { cohortId: cohort.cohortId, cycleId };
}

/** Drive and role records so the offer's job title has somewhere to live. */
async function linkRole(tx: Transaction, context: Context, companyId: string, jobRole: string | null) {
  if (!jobRole) return { driveId: null, roleId: null };
  let [drive] = await tx
    .select({ driveId: drives.driveId })
    .from(drives)
    .where(and(eq(drives.companyId, companyId), eq(drives.cycleId, context.cycleId)))
    .orderBy(drives.driveId)
    .limit(1);
  if (!drive) {
    [drive] = await tx.insert(drives).values({ companyId, cycleId: context.cycleId }).returning({ driveId: drives.driveId });
  }
  let [role] = await tx
    .select({ roleId: driveRoles.roleId })
    .from(driveRoles)
    .where(and(eq(driveRoles.driveId, drive.driveId), eq(driveRoles.jobTitle, jobRole)))
    .limit(1);
  if (!role) {
    [role] = await tx
      .insert(driveRoles)
      .values({ driveId: drive.driveId, jobTitle: jobRole })
      .returning({ roleId: driveRoles.roleId });
  }
  return { driveId: drive.driveId, roleId: role.roleId };
}

async function upsertOffer(tx: Transaction, context: Context, patch: Partial<StudentOffer>) {
  const [existing] = await tx
    .select({ offer: placementOffers, jobTitle: driveRoles.jobTitle })
    .from(placementOffers)
    .leftJoin(driveRoles, eq(driveRoles.roleId, placementOffers.roleId))
    .where(eq(placementOffers.enrollmentId, context.enrollmentId));

  let companyId = existing?.offer.companyId;
  if (patch.companyName !== undefined || !existing) {
    if (!patch.companyName) throw new StudentError("Select an existing company.", "companyName");
    const [company] = await tx
      .select({ companyId: companies.companyId })
      .from(companies)
      .where(eq(companies.name, patch.companyName));
    if (!company) throw new StudentError("Select an existing company.", "companyName");
    companyId = company.companyId;
  }
  if (companyId === undefined) throw new StudentError("Select an existing company.", "companyName");

  // The offer cannot predate the company's visit (PPT) in the same placement cycle.
  const visitDate = (await visitDatesByCompany(tx, context.cycleId)).get(companyId);
  const offerDate = patch.offerDate !== undefined ? patch.offerDate : existing?.offer.offerDate;
  const dateProblem = offerDateProblem(offerDate, visitDate);
  if (dateProblem) throw new StudentError(dateProblem, "offerDate");

  const currentRole = existing?.jobTitle ?? null;
  const jobRole = patch.jobRole !== undefined ? patch.jobRole : currentRole;
  const keepLink = existing && existing.offer.companyId === companyId && jobRole === currentRole;
  const link = keepLink
    ? { driveId: existing.offer.driveId, roleId: existing.offer.roleId }
    : await linkRole(tx, context, companyId, jobRole);
  const values = {
    companyId,
    ...link,
    packageLpa: patch.packageLpa !== undefined ? patch.packageLpa : (existing?.offer.packageLpa ?? null),
    offerType: patch.offerType !== undefined ? patch.offerType : (existing?.offer.offerType ?? null),
    offerDate: offerDate ?? null,
  };
  if (existing) {
    await tx.update(placementOffers).set(values).where(eq(placementOffers.enrollmentId, context.enrollmentId));
  } else {
    await tx.insert(placementOffers).values({
      enrollmentId: context.enrollmentId,
      cycleId: context.cycleId,
      ...values,
    });
  }
}

/** Moves an enrollment to another graduating year, carrying its offer without drive links. */
async function moveBatch(tx: Transaction, context: Context, batchYear: number) {
  const target = await ensureCohort(tx, context.departmentId, batchYear);
  const [offer] = await tx.select().from(placementOffers).where(eq(placementOffers.enrollmentId, context.enrollmentId));
  if (offer) await tx.delete(placementOffers).where(eq(placementOffers.enrollmentId, context.enrollmentId));
  await tx.delete(studentCycles).where(eq(studentCycles.enrollmentId, context.enrollmentId));
  await tx.update(enrollments).set({ cohortId: target.cohortId }).where(eq(enrollments.enrollmentId, context.enrollmentId));
  await tx.insert(studentCycles).values({
    cycleId: target.cycleId,
    enrollmentId: context.enrollmentId,
    cohortId: target.cohortId,
    registrationStatus: "REGISTERED",
  });
  if (offer) {
    await tx.insert(placementOffers).values({
      enrollmentId: context.enrollmentId,
      cycleId: target.cycleId,
      companyId: offer.companyId,
      packageLpa: offer.packageLpa,
      monthlyStipendInr: offer.monthlyStipendInr,
      offerType: offer.offerType,
      offerDate: offer.offerDate,
    });
  }
  return { ...context, cohortId: target.cohortId, cycleId: target.cycleId };
}

/**
 * Internal persistence only. All public entrypoints must authorize and pass the caller's
 * department before calling; a roll number outside that department is reported as missing.
 * An offer needs a REGISTERED student-cycle (db/README.md), so students created or moved here
 * are registered for their batch's cycle.
 */
export async function mutateStudent(
  departmentId: string, operation: Operation, input: unknown, roll?: unknown, expected?: unknown,
): Promise<StudentResult> {
  if (operation !== "create" && rollProblem(roll)) {
    return { fieldErrors: { rollNumber: rollProblem(roll)! } };
  }
  const parsed = operation === "create" || operation === "patch"
    ? validateStudent(input, operation === "create") : { data: {}, fieldErrors: {} };
  if (Object.keys(parsed.fieldErrors).length) return { fieldErrors: parsed.fieldErrors };
  if (operation !== "create" && typeof expected !== "string") return { error: "Reload this record before saving." };
  try {
    return await db.transaction(async tx => {
      const { data } = parsed;
      let context: Context;
      if (operation === "create") {
        const target = await ensureCohort(tx, departmentId, data.batchYear!);
        const [person] = await tx.insert(students).values({ name: data.name! }).returning({ studentId: students.studentId });
        const [enrollment] = await tx.insert(enrollments).values({
          studentId: person.studentId,
          rollNumber: data.rollNumber!,
          cohortId: target.cohortId,
          admissionYear: data.batchYear! - 4,
        }).returning({ enrollmentId: enrollments.enrollmentId });
        await tx.insert(studentCycles).values({
          cycleId: target.cycleId,
          enrollmentId: enrollment.enrollmentId,
          cohortId: target.cohortId,
          registrationStatus: "REGISTERED",
        });
        context = { departmentId, enrollmentId: enrollment.enrollmentId, ...target };
      } else {
        const id = Number(roll);
        // Serialize writes for the student and detect edits based on stale server data. The
        // department filter makes another department's roll number look like a missing student.
        await tx.execute(sql`select 1 from enrollments where roll_number = ${id} for update`);
        const [row] = await tx
          .select({
            enrollmentId: enrollments.enrollmentId,
            studentId: enrollments.studentId,
            cohortId: enrollments.cohortId,
          })
          .from(enrollments)
          .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
          .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
          .where(and(eq(enrollments.rollNumber, id), eq(programmes.departmentId, departmentId)));
        const [current] = row ? await readStudents(tx, departmentId, id) : [];
        if (!row || !current) return { error: "This student no longer exists. Refresh the records." };
        if (JSON.stringify(current) !== expected) return { error: "This record changed. Cancel and reopen it to load the latest values." };
        const [cycleRow] = await tx
          .select({ cycleId: studentCycles.cycleId })
          .from(studentCycles)
          .where(eq(studentCycles.enrollmentId, row.enrollmentId))
          .limit(1);
        if (!cycleRow) return { error: "This student has no placement-cycle registration to edit." };
        context = { departmentId, enrollmentId: row.enrollmentId, cohortId: row.cohortId, cycleId: cycleRow.cycleId };

        if (operation === "removeOffer") {
          if (!current.offer) return { error: "This student no longer has an offer." };
          await tx.delete(placementOffers).where(eq(placementOffers.enrollmentId, row.enrollmentId));
          return { ok: true };
        }
        if (operation === "removeStudent") {
          if (current.offer) return { error: "Remove the student's offer before deleting the student." };
          await tx.delete(studentCycles).where(eq(studentCycles.enrollmentId, row.enrollmentId));
          await tx.delete(enrollments).where(eq(enrollments.enrollmentId, row.enrollmentId));
          await tx.delete(students).where(and(
            eq(students.studentId, row.studentId),
            sql`not exists (select 1 from enrollments e where e.student_id = ${row.studentId})`,
          ));
          return { ok: true };
        }
        if (data.name !== undefined) {
          await tx.update(students).set({ name: data.name }).where(eq(students.studentId, row.studentId));
        }
        if (data.batchYear !== undefined && data.batchYear !== current.batchYear) {
          context = await moveBatch(tx, context, data.batchYear);
        }
      }
      if (data.offer && Object.keys(data.offer).length) await upsertOffer(tx, context, data.offer);
      return { ok: true };
    });
  } catch (error) {
    if (error instanceof StudentError) return { fieldErrors: { [error.field]: error.message } };
    const cause = error instanceof Error && error.cause ? error.cause : error;
    const code = (cause as { code?: string })?.code;
    if (code === "23505") return { fieldErrors: { rollNumber: "This roll number already exists. No existing record was changed." } };
    if (code === "23503") return { error: "A referenced record changed or still has an offer. Refresh and try again." };
    if (code === "23514" || code === "23502" || code === "22003") return { error: "The values do not meet database constraints." };
    console.error("Student mutation failed.", error);
    return { error: "Unable to save changes. Please retry." };
  }
}
class StudentError extends Error {
  constructor(message: string, readonly field: string) { super(message); }
}
