import "server-only";
import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  cohorts,
  companies,
  cycleCohorts,
  degrees,
  driveRoles,
  drives,
  enrollments,
  genderTypes,
  placementCycles,
  placementOffers,
  programmes,
  reservationCategories,
  studentCycles,
  students,
} from "@/db/schema";
import type { CohortOption, StudentData, StudentDegreeLevel, StudentParticipation, StudentRecord } from "./types";
import { readDriveOptions } from "@/lib/drives/read";

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const programmeLabel = (degreeCode: string, specialization: string | null) =>
  specialization ? `${degreeCode} (${specialization})` : degreeCode;

/** The department's enrollments for one explicit degree level, optionally one roll number. */
const editorScope = (departmentId: string, level: StudentDegreeLevel, roll?: number): SQL =>
  and(
    eq(programmes.departmentId, departmentId),
    eq(degrees.level, level),
    roll === undefined ? undefined : eq(enrollments.rollNumber, roll),
  )!;

/**
 * The student editor's records for one department and explicit degree level, with their
 * participations and final offer. One place builds the record so the editor's stale-edit check
 * (which compares a record's JSON) sees identical shapes from the list and from a single read.
 * Participations are read separately, so neither students nor offers are multiplied by joins.
 */
export async function readStudents(
  connection: Database | Transaction,
  departmentId: string,
  level: StudentDegreeLevel,
  roll?: number,
): Promise<StudentRecord[]> {
  const offerCycles = placementCycles;
  const rows = await connection
    .select({
      studentId: students.studentId,
      enrollmentId: enrollments.enrollmentId,
      rollNumber: enrollments.rollNumber,
      name: students.name,
      genderCode: students.genderCode,
      reservationCategoryCode: enrollments.reservationCategoryCode,
      programmeId: programmes.programmeId,
      degreeCode: degrees.code,
      specialization: programmes.specialization,
      cohortId: cohorts.cohortId,
      batchYear: cohorts.graduationYear,
      admissionYear: enrollments.admissionYear,
      offerId: placementOffers.offerId,
      offerCycleId: placementOffers.cycleId,
      offerCycleCode: offerCycles.code,
      companyId: companies.companyId,
      companyName: companies.name,
      driveId: placementOffers.driveId,
      roleId: placementOffers.roleId,
      driveReference: drives.reference,
      jobRole: driveRoles.jobTitle,
      roleDomain: driveRoles.domain,
      packageLpa: placementOffers.packageLpa,
      offerType: placementOffers.offerType,
      offerDate: placementOffers.offerDate,
    })
    .from(enrollments)
    .innerJoin(students, eq(students.studentId, enrollments.studentId))
    .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
    .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
    .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId))
    .leftJoin(placementOffers, eq(placementOffers.enrollmentId, enrollments.enrollmentId))
    .leftJoin(offerCycles, eq(offerCycles.cycleId, placementOffers.cycleId))
    .leftJoin(companies, eq(companies.companyId, placementOffers.companyId))
    .leftJoin(drives, eq(drives.driveId, placementOffers.driveId))
    .leftJoin(driveRoles, eq(driveRoles.roleId, placementOffers.roleId))
    .where(editorScope(departmentId, level, roll))
    .orderBy(cohorts.graduationYear, enrollments.rollNumber);

  const participations = new Map<string, StudentParticipation[]>();
  if (rows.length) {
    const cycleRows = await connection
      .select({
        enrollmentId: studentCycles.enrollmentId,
        cycleId: studentCycles.cycleId,
        cycleCode: placementCycles.code,
        registrationStatus: studentCycles.registrationStatus,
      })
      .from(studentCycles)
      .innerJoin(placementCycles, eq(placementCycles.cycleId, studentCycles.cycleId))
      .where(inArray(studentCycles.enrollmentId, rows.map((row) => row.enrollmentId)))
      .orderBy(asc(placementCycles.code), asc(studentCycles.cycleId));
    for (const { enrollmentId, ...participation } of cycleRows) {
      const list = participations.get(enrollmentId) ?? [];
      list.push(participation);
      participations.set(enrollmentId, list);
    }
  }

  return rows.map((row) => ({
    studentId: row.studentId,
    enrollmentId: row.enrollmentId,
    rollNumber: row.rollNumber,
    name: row.name,
    genderCode: row.genderCode,
    reservationCategoryCode: row.reservationCategoryCode,
    programmeId: row.programmeId,
    programmeLabel: programmeLabel(row.degreeCode, row.specialization),
    cohortId: row.cohortId,
    batchYear: row.batchYear,
    admissionYear: row.admissionYear,
    participations: participations.get(row.enrollmentId) ?? [],
    offer: row.offerId && row.offerCycleId && row.offerCycleCode && row.companyId && row.companyName
      ? {
          offerId: row.offerId,
          cycleId: row.offerCycleId,
          cycleCode: row.offerCycleCode,
          companyId: row.companyId,
          companyName: row.companyName,
          driveId: row.driveId,
          driveReference: row.driveReference,
          roleId: row.roleId,
          jobRole: row.jobRole,
          roleDomain: row.roleDomain,
          packageLpa: row.packageLpa,
          offerType: row.offerType,
          offerDate: row.offerDate,
        }
      : null,
  }));
}

/** Choices for the explicit level: matching department programmes/cohorts, every cycle and company. */
export async function readStudentOptions(
  connection: Database | Transaction,
  departmentId: string,
  level: StudentDegreeLevel,
): Promise<Omit<StudentData, "students">> {
  const [programmeRows, cycleRows, cohortRows, cohortCycleRows, companyRows, driveOptions, genderRows, categoryRows] = await Promise.all([
    connection
      .select({ programmeId: programmes.programmeId, degreeCode: degrees.code, specialization: programmes.specialization })
      .from(programmes)
      .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId))
      .where(and(eq(programmes.departmentId, departmentId), eq(degrees.level, level)))
      .orderBy(asc(degrees.code), asc(programmes.specialization), asc(programmes.programmeId)),
    connection
      .select({ cycleId: placementCycles.cycleId, code: placementCycles.code })
      .from(placementCycles)
      .orderBy(desc(placementCycles.code), asc(placementCycles.cycleId)),
    connection
      .select({ cohortId: cohorts.cohortId, programmeId: cohorts.programmeId, graduationYear: cohorts.graduationYear })
      .from(cohorts)
      .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
      .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId))
      .where(and(eq(programmes.departmentId, departmentId), eq(degrees.level, level)))
      .orderBy(desc(cohorts.graduationYear), asc(cohorts.cohortId)),
    connection
      .select({ cohortId: cycleCohorts.cohortId, cycleId: cycleCohorts.cycleId })
      .from(cycleCohorts)
      .innerJoin(cohorts, eq(cohorts.cohortId, cycleCohorts.cohortId))
      .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
      .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId))
      .where(and(eq(programmes.departmentId, departmentId), eq(degrees.level, level))),
    connection
      .select({ companyId: companies.companyId, name: companies.name, domain: companies.domain })
      .from(companies)
      .orderBy(asc(companies.name)),
    readDriveOptions(connection, {}),
    connection.select({ code: genderTypes.code, label: genderTypes.label }).from(genderTypes).orderBy(asc(genderTypes.label), asc(genderTypes.code)),
    connection.select({ code: reservationCategories.code, label: reservationCategories.label }).from(reservationCategories).orderBy(asc(reservationCategories.label), asc(reservationCategories.code)),
  ]);
  const cycleIds = new Map<string, string[]>();
  for (const { cohortId, cycleId } of cohortCycleRows) cycleIds.set(cohortId, [...(cycleIds.get(cohortId) ?? []), cycleId]);
  const cohortOptions: CohortOption[] = cohortRows.map((cohort) => ({ ...cohort, cycleIds: cycleIds.get(cohort.cohortId) ?? [] }));
  return {
    level,
    programmes: programmeRows.map((row) => ({ programmeId: row.programmeId, label: programmeLabel(row.degreeCode, row.specialization) })),
    cycles: cycleRows,
    cohorts: cohortOptions,
    companies: companyRows,
    drives: driveOptions,
    genderTypes: genderRows,
    reservationCategories: categoryRows,
  };
}
