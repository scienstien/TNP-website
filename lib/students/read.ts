import "server-only";
import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  cohorts,
  companies,
  cycleCohorts,
  degrees,
  driveRoles,
  enrollments,
  placementCycles,
  placementOffers,
  programmes,
  studentCycles,
  students,
} from "@/db/schema";
import type { CohortOption, StudentData, StudentParticipation, StudentRecord } from "./types";

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const programmeLabel = (degreeCode: string, specialization: string | null) =>
  specialization ? `${degreeCode} (${specialization})` : degreeCode;

/** The department's undergraduate enrollments, optionally one roll number. */
const editorScope = (departmentId: string, roll?: number): SQL =>
  and(
    eq(programmes.departmentId, departmentId),
    eq(degrees.level, "UG"),
    roll === undefined ? undefined : eq(enrollments.rollNumber, roll),
  )!;

/**
 * The student editor's records for one department: undergraduate enrollments with their
 * participations and final offer. One place builds the record so the editor's stale-edit check
 * (which compares a record's JSON) sees identical shapes from the list and from a single read.
 * Participations are read separately, so neither students nor offers are multiplied by joins.
 */
export async function readStudents(
  connection: Database | Transaction,
  departmentId: string,
  roll?: number,
): Promise<StudentRecord[]> {
  const offerCycles = placementCycles;
  const rows = await connection
    .select({
      studentId: students.studentId,
      enrollmentId: enrollments.enrollmentId,
      rollNumber: enrollments.rollNumber,
      name: students.name,
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
      jobRole: driveRoles.jobTitle,
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
    .leftJoin(driveRoles, eq(driveRoles.roleId, placementOffers.roleId))
    .where(editorScope(departmentId, roll))
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
          jobRole: row.jobRole,
          packageLpa: row.packageLpa,
          offerType: row.offerType,
          offerDate: row.offerDate,
        }
      : null,
  }));
}

/** The choices the editor offers: the department's UG programmes and cohorts, every cycle and company. */
export async function readStudentOptions(
  connection: Database | Transaction,
  departmentId: string,
): Promise<Omit<StudentData, "students">> {
  const [programmeRows, cycleRows, cohortRows, cohortCycleRows, companyRows] = await Promise.all([
    connection
      .select({ programmeId: programmes.programmeId, degreeCode: degrees.code, specialization: programmes.specialization })
      .from(programmes)
      .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId))
      .where(and(eq(programmes.departmentId, departmentId), eq(degrees.level, "UG")))
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
      .where(and(eq(programmes.departmentId, departmentId), eq(degrees.level, "UG")))
      .orderBy(desc(cohorts.graduationYear), asc(cohorts.cohortId)),
    connection
      .select({ cohortId: cycleCohorts.cohortId, cycleId: cycleCohorts.cycleId })
      .from(cycleCohorts)
      .innerJoin(cohorts, eq(cohorts.cohortId, cycleCohorts.cohortId))
      .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
      .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId))
      .where(and(eq(programmes.departmentId, departmentId), eq(degrees.level, "UG"))),
    connection
      .select({ companyId: companies.companyId, name: companies.name, domain: companies.domain })
      .from(companies)
      .orderBy(asc(companies.name)),
  ]);
  const cycleIds = new Map<string, string[]>();
  for (const { cohortId, cycleId } of cohortCycleRows) cycleIds.set(cohortId, [...(cycleIds.get(cohortId) ?? []), cycleId]);
  const cohortOptions: CohortOption[] = cohortRows.map((cohort) => ({ ...cohort, cycleIds: cycleIds.get(cohort.cohortId) ?? [] }));
  return {
    programmes: programmeRows.map((row) => ({ programmeId: row.programmeId, label: programmeLabel(row.degreeCode, row.specialization) })),
    cycles: cycleRows,
    cohorts: cohortOptions,
    companies: companyRows,
  };
}
