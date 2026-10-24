import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  cohorts,
  companies,
  cycleCohorts,
  degrees,
  departments,
  driveRoles,
  enrollments,
  placementCycles,
  placementOffers,
  programmes,
  studentCycles,
  students,
} from "@/db/schema";
import type { OfferTypeValue } from "@/lib/placements/types";
import { STUDENT_PAGE_SIZE, type StudentListFilters } from "./list-params";
import type { CohortOption, StudentData, StudentListMeta, StudentParticipation, StudentRecord } from "./types";

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const programmeLabel = (degreeCode: string, specialization: string | null) =>
  specialization ? `${degreeCode} (${specialization})` : degreeCode;

/** Undergraduate enrollments of one department (every department when null), optionally one roll number. */
const editorScope = (departmentId: string | null, roll?: number): SQL =>
  and(
    departmentId === null ? undefined : eq(programmes.departmentId, departmentId),
    eq(degrees.level, "UG"),
    roll === undefined ? undefined : eq(enrollments.rollNumber, roll),
  )!;

/**
 * The student editor's records for one department (or, read-only, every department when null): undergraduate enrollments with their
 * participations and final offer. One place builds the record so the editor's stale-edit check
 * (which compares a record's JSON) sees identical shapes from the list and from a single read.
 * Participations are read separately, so neither students nor offers are multiplied by joins.
 */
export async function readStudents(
  connection: Database | Transaction,
  departmentId: string | null,
  roll?: number,
  /** One page of the list: extra conditions (search and filters) and the row window. */
  paging?: { where?: SQL; limit: number; offset: number },
): Promise<StudentRecord[]> {
  const offerCycles = placementCycles;
  const query = connection
    .select({
      studentId: students.studentId,
      enrollmentId: enrollments.enrollmentId,
      rollNumber: enrollments.rollNumber,
      name: students.name,
      departmentCode: departments.code,
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
    .innerJoin(departments, eq(departments.departmentId, programmes.departmentId))
    .leftJoin(placementOffers, eq(placementOffers.enrollmentId, enrollments.enrollmentId))
    .leftJoin(offerCycles, eq(offerCycles.cycleId, placementOffers.cycleId))
    .leftJoin(companies, eq(companies.companyId, placementOffers.companyId))
    .leftJoin(driveRoles, eq(driveRoles.roleId, placementOffers.roleId))
    .where(and(editorScope(departmentId, roll), paging?.where))
    .orderBy(cohorts.graduationYear, enrollments.rollNumber)
    .$dynamic();
  const rows = await (paging ? query.limit(paging.limit).offset(paging.offset) : query);

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
    departmentCode: row.departmentCode,
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
  departmentId: string | null,
): Promise<Omit<StudentData, "students" | "list">> {
  const [programmeRows, cycleRows, cohortRows, cohortCycleRows, companyRows] = await Promise.all([
    connection
      .select({ programmeId: programmes.programmeId, degreeCode: degrees.code, specialization: programmes.specialization })
      .from(programmes)
      .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId))
      .where(and(departmentId === null ? undefined : eq(programmes.departmentId, departmentId), eq(degrees.level, "UG")))
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
      .where(and(departmentId === null ? undefined : eq(programmes.departmentId, departmentId), eq(degrees.level, "UG")))
      .orderBy(desc(cohorts.graduationYear), asc(cohorts.cohortId)),
    connection
      .select({ cohortId: cycleCohorts.cohortId, cycleId: cycleCohorts.cycleId })
      .from(cycleCohorts)
      .innerJoin(cohorts, eq(cohorts.cohortId, cycleCohorts.cohortId))
      .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
      .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId))
      .where(and(departmentId === null ? undefined : eq(programmes.departmentId, departmentId), eq(degrees.level, "UG"))),
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

/** Escapes LIKE wildcards so a search for "100%" or "a_b" matches those characters literally. */
const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

/** Has a REGISTERED student-cycle row; derived status never relies on a stored placement status. */
const registeredCycle = sql`exists (select 1 from ${studentCycles} where ${studentCycles.enrollmentId} = ${enrollments.enrollmentId} and ${studentCycles.registrationStatus} = 'REGISTERED')`;

/** The list's search and filters as SQL, over the joins readStudents and countStudents share. */
function listWhere(filters: StudentListFilters): SQL | undefined {
  const pattern = filters.q ? likePattern(filters.q) : null;
  return and(
    filters.department ? eq(departments.code, filters.department) : undefined,
    filters.batch !== null ? eq(cohorts.graduationYear, filters.batch) : undefined,
    filters.company ? eq(companies.name, filters.company) : undefined,
    filters.status === "Placed" ? isNotNull(placementOffers.offerId) : undefined,
    filters.status === "Unplaced" ? and(isNull(placementOffers.offerId), registeredCycle) : undefined,
    filters.status === "Not registered" ? and(isNull(placementOffers.offerId), sql`not ${registeredCycle}`) : undefined,
    filters.status && !["Placed", "Unplaced", "Not registered"].includes(filters.status)
      ? eq(placementOffers.offerType, filters.status as OfferTypeValue) : undefined,
    pattern ? or(
      sql`${enrollments.rollNumber}::text ilike ${pattern}`,
      ilike(students.name, pattern),
      ilike(degrees.code, pattern),
      ilike(sql`coalesce(${programmes.specialization}, '')`, pattern),
      sql`${cohorts.graduationYear}::text ilike ${pattern}`,
      ilike(sql`coalesce(${companies.name}, '')`, pattern),
      sql`exists (select 1 from ${studentCycles} join ${placementCycles} on ${placementCycles.cycleId} = ${studentCycles.cycleId} where ${studentCycles.enrollmentId} = ${enrollments.enrollmentId} and ${placementCycles.code} ilike ${pattern})`,
    ) : undefined,
  );
}

/**
 * One page of the records list with its totals and filter choices, all counted in SQL so the
 * browser never receives every student. The page is clamped to the last page.
 */
export async function readStudentList(
  connection: Database | Transaction,
  departmentId: string | null,
  filters: StudentListFilters,
): Promise<{ students: StudentRecord[]; list: StudentListMeta }> {
  const scope = editorScope(departmentId);
  const [counts] = await connection
    .select({
      recorded: count(),
      placed: count(placementOffers.offerId),
      unplaced: sql<number>`count(*) filter (where ${placementOffers.offerId} is null and ${registeredCycle})`.mapWith(Number),
      matching: sql<number>`count(*) filter (where ${listWhere(filters) ?? sql`true`})`.mapWith(Number),
    })
    .from(enrollments)
    .innerJoin(students, eq(students.studentId, enrollments.studentId))
    .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
    .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
    .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId))
    .innerJoin(departments, eq(departments.departmentId, programmes.departmentId))
    .leftJoin(placementOffers, eq(placementOffers.enrollmentId, enrollments.enrollmentId))
    .leftJoin(companies, eq(companies.companyId, placementOffers.companyId))
    .where(scope);

  const pages = Math.max(1, Math.ceil(counts.matching / STUDENT_PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const [rows, batchRows, companyRows, departmentRows] = await Promise.all([
    counts.matching === 0 ? Promise.resolve([]) : readStudents(connection, departmentId, undefined, { where: listWhere(filters), limit: STUDENT_PAGE_SIZE, offset: (page - 1) * STUDENT_PAGE_SIZE }),
    connection.selectDistinct({ year: cohorts.graduationYear }).from(cohorts)
      .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
      .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId)).where(scope).orderBy(desc(cohorts.graduationYear)),
    connection.selectDistinct({ name: companies.name }).from(placementOffers)
      .innerJoin(companies, eq(companies.companyId, placementOffers.companyId))
      .innerJoin(enrollments, eq(enrollments.enrollmentId, placementOffers.enrollmentId))
      .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
      .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
      .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId)).where(scope).orderBy(asc(companies.name)),
    departmentId === null
      ? connection.selectDistinct({ code: departments.code }).from(departments)
        .innerJoin(programmes, eq(programmes.departmentId, departments.departmentId))
        .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId)).where(eq(degrees.level, "UG")).orderBy(asc(departments.code))
      : Promise.resolve([] as { code: string }[]),
  ]);
  return {
    students: rows,
    list: {
      filters: { ...filters, page },
      page,
      pageSize: STUDENT_PAGE_SIZE,
      matching: counts.matching,
      recorded: counts.recorded,
      placed: counts.placed,
      unplaced: counts.unplaced,
      batches: batchRows.map((row) => row.year),
      companies: companyRows.map((row) => row.name),
      departmentCodes: departmentRows.map((row) => row.code),
    },
  };
}
