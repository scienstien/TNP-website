import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cohorts,
  companies,
  cycleCohorts,
  degrees,
  driveRoles,
  drives,
  enrollments,
  placementCycles,
  placementOffers,
  programmes,
  studentCycles,
  students,
} from "@/db/schema";
import { visitDatesByCompany } from "@/lib/companies/visit";
import { readStudents, type Transaction } from "./read";
import { offerTarget, participationRemovalProblem, registrationChangeProblem, sharedPersonProblem } from "./rules";
import type { OfferChanges, ParticipationInput, StudentResult } from "./types";
import { offerDateProblem, rollProblem, uuid, validateParticipation, validateStudent } from "./validation";

export type Operation = "create" | "patch" | "removeOffer" | "removeStudent" | "setParticipation" | "removeParticipation";

/** The student-cycle an offer is written for. */
interface OfferContext {
  enrollmentId: string;
  cycleId: string;
}

/**
 * The cohort of one of the department's undergraduate programmes for a graduation year. A missing
 * cohort is created: programme and graduation year are both explicit choices (AGENTS.md: cohort IDs
 * are generated internally for confirmed programme/year combinations).
 */
async function cohortFor(tx: Transaction, departmentId: string, programmeId: string, graduationYear: number) {
  const [programme] = await tx
    .select({ programmeId: programmes.programmeId })
    .from(programmes)
    .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId))
    .where(and(eq(programmes.programmeId, programmeId), eq(programmes.departmentId, departmentId), eq(degrees.level, "UG")));
  if (!programme) throw new StudentError("Choose one of this department's undergraduate programmes.", "programmeId");
  await tx.insert(cohorts).values({ programmeId, graduationYear }).onConflictDoNothing();
  const [cohort] = await tx
    .select({ cohortId: cohorts.cohortId })
    .from(cohorts)
    .where(and(eq(cohorts.programmeId, programmeId), eq(cohorts.graduationYear, graduationYear)));
  return cohort.cohortId;
}

/**
 * Locks the enrollment's participations and offer, so registration and offer writes are serialized
 * (every write path has already locked the enrollment row itself).
 */
async function lockParticipation(tx: Transaction, enrollmentId: string) {
  const participations = await tx
    .select({ cycleId: studentCycles.cycleId, registrationStatus: studentCycles.registrationStatus })
    .from(studentCycles)
    .where(eq(studentCycles.enrollmentId, enrollmentId))
    .orderBy(studentCycles.cycleId)
    .for("update");
  const [existing] = await tx
    .select({ offer: placementOffers, jobTitle: driveRoles.jobTitle })
    .from(placementOffers)
    .leftJoin(driveRoles, eq(driveRoles.roleId, placementOffers.roleId))
    .where(eq(placementOffers.enrollmentId, enrollmentId))
    .for("update", { of: placementOffers });
  return { participations, existing };
}

/**
 * Registers the enrollment for an explicitly chosen, existing placement cycle, or changes that
 * registration's status. Choosing a cycle the cohort is not associated with yet records that
 * association (cycle_cohorts): it is the administrator's explicit choice, never inferred from a
 * year or date. Cycles are never created here.
 */
async function registerParticipation(
  tx: Transaction, enrollmentId: string, cohortId: string, input: ParticipationInput, offerCycleId: string | null,
) {
  const problem = registrationChangeProblem(offerCycleId, input.cycleId, input.registrationStatus);
  if (problem) throw new StudentError(problem, "registrationStatus");
  const [cycle] = await tx
    .select({ cycleId: placementCycles.cycleId })
    .from(placementCycles)
    .where(eq(placementCycles.cycleId, input.cycleId));
  if (!cycle) throw new StudentError("That placement cycle does not exist. Refresh and choose another.", "participation");
  await tx.insert(cycleCohorts).values({ cycleId: input.cycleId, cohortId }).onConflictDoNothing();
  await tx
    .insert(studentCycles)
    .values({ cycleId: input.cycleId, enrollmentId, cohortId, registrationStatus: input.registrationStatus })
    .onConflictDoUpdate({
      target: [studentCycles.cycleId, studentCycles.enrollmentId],
      set: { registrationStatus: input.registrationStatus },
    });
}

/** Drive and role records so the offer's job title has somewhere to live. */
async function linkRole(tx: Transaction, context: OfferContext, companyId: string, jobRole: string | null) {
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

/**
 * Creates or updates the enrollment's final offer for the one REGISTERED student-cycle
 * offerTarget() accepts; ambiguous targets are rejected. The company is chosen by ID.
 */
async function writeOffer(tx: Transaction, enrollmentId: string, patch: OfferChanges) {
  const { participations, existing } = await lockParticipation(tx, enrollmentId);
  const target = offerTarget(participations, existing?.offer.cycleId ?? null, patch.cycleId);
  if (target.problem !== undefined) throw new StudentError(target.problem, "offer");
  const context: OfferContext = { enrollmentId, cycleId: target.cycleId };

  let companyId = existing?.offer.companyId;
  if (patch.companyId !== undefined || !existing) {
    if (!patch.companyId) throw new StudentError("Select an existing company.", "companyId");
    const [company] = await tx
      .select({ companyId: companies.companyId })
      .from(companies)
      .where(eq(companies.companyId, patch.companyId));
    if (!company) throw new StudentError("Select an existing company.", "companyId");
    companyId = company.companyId;
  }
  if (companyId === undefined) throw new StudentError("Select an existing company.", "companyId");

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
  // Columns the editor does not show (such as the monthly stipend) are never written here.
  const values = {
    companyId,
    ...link,
    packageLpa: patch.packageLpa !== undefined ? patch.packageLpa : (existing?.offer.packageLpa ?? null),
    offerType: patch.offerType !== undefined ? patch.offerType : (existing?.offer.offerType ?? null),
    offerDate: offerDate ?? null,
  };
  if (existing) {
    await tx.update(placementOffers).set(values).where(eq(placementOffers.offerId, existing.offer.offerId));
  } else {
    await tx.insert(placementOffers).values({ enrollmentId, cycleId: context.cycleId, ...values });
  }
}

/**
 * Internal persistence only. All public entrypoints must authorize and pass the caller's
 * department before calling; a roll number outside that department is reported as missing.
 * Programme, cohort, cycle and registration are always explicit: nothing is inferred from a
 * graduation year or a date, and no placement cycle is created. Every rejection inside the
 * transaction throws, so a failed request leaves no partial write behind.
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
  const participation = operation === "setParticipation" ? validateParticipation(input) : null;
  if (participation && !participation.data) return { fieldErrors: participation.fieldErrors };
  const removedCycleId = operation === "removeParticipation"
    ? uuid((input as { cycleId?: unknown } | null)?.cycleId) : null;
  if (operation === "removeParticipation" && !removedCycleId) return { fieldErrors: { participation: "Choose a placement cycle." } };
  if (operation !== "create" && typeof expected !== "string") return { error: "Reload this record before saving." };
  try {
    return await db.transaction(async tx => {
      const { data } = parsed;
      if (operation === "create") {
        const cohortId = await cohortFor(tx, departmentId, data.programmeId!, data.batchYear!);
        // Always a new person: reusing an existing person needs an explicit identity and
        // shared-person policy (never a name match).
        const [person] = await tx.insert(students).values({ name: data.name! }).returning({ studentId: students.studentId });
        const [enrollment] = await tx.insert(enrollments).values({
          studentId: person.studentId,
          rollNumber: data.rollNumber!,
          cohortId,
          admissionYear: data.admissionYear ?? null,
        }).returning({ enrollmentId: enrollments.enrollmentId });
        if (data.participation) {
          await registerParticipation(tx, enrollment.enrollmentId, cohortId, data.participation, null);
        }
        if (data.offer && Object.keys(data.offer).length) await writeOffer(tx, enrollment.enrollmentId, data.offer);
        return { ok: true };
      }

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
      const enrollmentId = row.enrollmentId;

      // Enrollment-level operations never need a placement-cycle participation.
      if (operation === "removeOffer") {
        if (!current.offer) return { error: "This student no longer has an offer." };
        await tx.delete(placementOffers).where(eq(placementOffers.offerId, current.offer.offerId));
        return { ok: true };
      }
      if (operation === "removeStudent") {
        if (current.offer) return { error: "Remove the student's offer before deleting the student." };
        await tx.delete(studentCycles).where(eq(studentCycles.enrollmentId, enrollmentId));
        await tx.delete(enrollments).where(eq(enrollments.enrollmentId, enrollmentId));
        await tx.delete(students).where(and(
          eq(students.studentId, row.studentId),
          sql`not exists (select 1 from enrollments e where e.student_id = ${row.studentId})`,
        ));
        return { ok: true };
      }
      if (operation === "setParticipation") {
        const { existing } = await lockParticipation(tx, enrollmentId);
        await registerParticipation(tx, enrollmentId, row.cohortId, participation!.data!, existing?.offer.cycleId ?? null);
        return { ok: true };
      }
      if (operation === "removeParticipation") {
        const { participations, existing } = await lockParticipation(tx, enrollmentId);
        const problem = participationRemovalProblem(existing?.offer.cycleId ?? null, removedCycleId!);
        if (problem) throw new StudentError(problem, "participation");
        if (!participations.some((item) => item.cycleId === removedCycleId)) {
          throw new StudentError("This registration no longer exists. Refresh the records.", "participation");
        }
        await tx.delete(studentCycles).where(and(
          eq(studentCycles.cycleId, removedCycleId!),
          eq(studentCycles.enrollmentId, enrollmentId),
        ));
        return { ok: true };
      }

      // Patch. A cohort move used to delete every participation and re-create the offer in a cycle
      // inferred from the year; it stays rejected until a move can preserve that history.
      if (data.programmeId !== undefined && data.programmeId !== current.programmeId) {
        throw new StudentError("Moving a student to another programme is not supported; it would discard registrations and offer details.", "programmeId");
      }
      if (data.batchYear !== undefined && data.batchYear !== current.batchYear) {
        throw new StudentError("Moving a student to another batch is not supported; it would discard registrations and offer details.", "batchYear");
      }
      if (data.admissionYear !== undefined && data.admissionYear !== current.admissionYear) {
        await tx.update(enrollments).set({ admissionYear: data.admissionYear }).where(eq(enrollments.enrollmentId, enrollmentId));
      }
      if (data.name !== undefined && data.name !== current.name) {
        // The name belongs to the person, who may also be enrolled elsewhere.
        await tx.execute(sql`select 1 from students where student_id = ${row.studentId} for update`);
        const others = await tx
          .select({ departmentId: programmes.departmentId })
          .from(enrollments)
          .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
          .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
          .where(and(eq(enrollments.studentId, row.studentId), ne(enrollments.enrollmentId, enrollmentId)));
        const problem = sharedPersonProblem(departmentId, others.map((other) => other.departmentId));
        if (problem) throw new StudentError(problem, "name");
        await tx.update(students).set({ name: data.name }).where(eq(students.studentId, row.studentId));
      }
      if (data.offer && Object.keys(data.offer).length) await writeOffer(tx, enrollmentId, data.offer);
      return { ok: true };
    });
  } catch (error) {
    if (error instanceof StudentError) return { fieldErrors: { [error.field]: error.message } };
    const cause = (error instanceof Error && error.cause ? error.cause : error) as { code?: string; constraint_name?: string };
    if (cause?.code === "23505") {
      return cause.constraint_name?.includes("roll_number")
        ? { fieldErrors: { rollNumber: "This roll number already exists. No existing record was changed." } }
        : { error: "A conflicting change was saved at the same time. Refresh and try again." };
    }
    if (cause?.code === "23503") return { error: "A referenced record changed or still has an offer. Refresh and try again." };
    if (cause?.code === "23514" || cause?.code === "23502" || cause?.code === "22003") return { error: "The values do not meet database constraints." };
    console.error("Student mutation failed.", error);
    return { error: "Unable to save changes. Please retry." };
  }
}
class StudentError extends Error {
  constructor(message: string, readonly field: string) { super(message); }
}
