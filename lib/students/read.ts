import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  cohorts,
  companies,
  degrees,
  driveRoles,
  enrollments,
  placementOffers,
  programmes,
  students,
} from "@/db/schema";
import type { StudentRecord } from "./types";

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * The student editor's records for one department: undergraduate (B.Tech) enrollments with
 * their final offer, if any. One place builds the record so the editor's stale-edit check
 * (which compares a record's JSON) sees identical shapes from the list and from a single read.
 */
export async function readStudents(
  connection: Database | Transaction,
  departmentId: string,
  roll?: number,
): Promise<StudentRecord[]> {
  const rows = await connection
    .select({
      rollNumber: enrollments.rollNumber,
      name: students.name,
      batchYear: cohorts.graduationYear,
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
    .leftJoin(companies, eq(companies.companyId, placementOffers.companyId))
    .leftJoin(driveRoles, eq(driveRoles.roleId, placementOffers.roleId))
    .where(
      and(
        eq(programmes.departmentId, departmentId),
        eq(degrees.level, "UG"),
        roll === undefined ? undefined : eq(enrollments.rollNumber, roll),
      ),
    )
    .orderBy(cohorts.graduationYear, enrollments.rollNumber);
  return rows.map((row) => ({
    rollNumber: row.rollNumber,
    name: row.name,
    batchYear: row.batchYear,
    offer: row.companyName
      ? {
          companyName: row.companyName,
          jobRole: row.jobRole,
          packageLpa: row.packageLpa,
          offerType: row.offerType,
          offerDate: row.offerDate,
        }
      : null,
  }));
}
