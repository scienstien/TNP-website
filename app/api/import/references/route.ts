import ExcelJS from "exceljs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cohorts, companies, degrees, departments, driveRoles, drives, genderTypes, placementCycles, programmes, reservationCategories } from "@/db/schema";
import { getCurrentUser, isAdminRole, resolveDepartment } from "@/lib/auth/dal";

/** Catalogue identities only: no student names, rolls, offers, or contact details. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  if (!isAdminRole(user.role)) return new Response("Administrator access required.", { status: 403 });
  const scope = await resolveDepartment(user);
  if (!scope) return new Response("Choose one department first.", { status: 400 });
  const workbook = new ExcelJS.Workbook();
  const instructions = workbook.addWorksheet("Read me");
  instructions.getColumn(1).width = 120;
  instructions.addRow(["REFERENCE ONLY — do not upload this workbook. Copy exact codes/IDs to a downloaded template."]);
  instructions.addRow([`Department: ${scope.name} (${scope.code}). Generated ${new Date().toISOString()}.`]);
  instructions.addRow(["Department aliases: none. Codes are lower-cased; other catalogue codes and specialization names must match exactly."]);
  await db.transaction(async tx => {
    const add = (name: string, columns: string[], rows: Record<string, unknown>[]) => {
      const sheet = workbook.addWorksheet(name);
      sheet.columns = columns.map(key => ({ header: key, key, width: 30, style: { numFmt: "@" } }));
      sheet.getRow(1).font = { bold: true };
      for (const row of rows) sheet.addRow(columns.map(key => row[key] === null ? "" : String(row[key])));
    };
    add("Department", ["department_code", "department_name"], [{ department_code: scope.code, department_name: scope.name }]);
    const academic = { department_code: departments.code, degree_code: degrees.code, degree_level: degrees.level, specialization: programmes.specialization };
    add("Programmes", Object.keys(academic), await tx.select(academic).from(programmes)
      .innerJoin(departments, eq(programmes.departmentId, departments.departmentId)).innerJoin(degrees, eq(programmes.degreeId, degrees.degreeId))
      .where(eq(programmes.departmentId, scope.departmentId)).orderBy(degrees.code, programmes.specialization));
    const cohortFields = { ...academic, graduation_year: cohorts.graduationYear };
    add("Cohorts", Object.keys(cohortFields), await tx.select(cohortFields).from(cohorts).innerJoin(programmes, eq(cohorts.programmeId, programmes.programmeId))
      .innerJoin(departments, eq(programmes.departmentId, departments.departmentId)).innerJoin(degrees, eq(programmes.degreeId, degrees.degreeId))
      .where(eq(programmes.departmentId, scope.departmentId)).orderBy(cohorts.graduationYear, degrees.code));
    add("Genders", ["code", "label"], await tx.select().from(genderTypes).orderBy(genderTypes.code));
    add("Reservation categories", ["code", "label"], await tx.select().from(reservationCategories).orderBy(reservationCategories.code));
    add("Cycles", ["cycle_code", "starts_on", "ends_on"], await tx.select({ cycle_code: placementCycles.code, starts_on: placementCycles.startsOn, ends_on: placementCycles.endsOn }).from(placementCycles).orderBy(placementCycles.code));
    add("Companies", ["company_name"], await tx.select({ company_name: companies.name }).from(companies).orderBy(companies.name));
    add("Drives and roles", ["company_name", "cycle_code", "drive_id", "reference", "role_id", "job_title", "role_domain"], await tx.select({ company_name: companies.name, cycle_code: placementCycles.code, drive_id: drives.driveId, reference: drives.reference, role_id: driveRoles.roleId, job_title: driveRoles.jobTitle, role_domain: driveRoles.domain })
      .from(drives).innerJoin(companies, eq(companies.companyId, drives.companyId)).innerJoin(placementCycles, eq(placementCycles.cycleId, drives.cycleId))
      .leftJoin(driveRoles, and(eq(driveRoles.driveId, drives.driveId))).orderBy(companies.name, placementCycles.code, drives.driveId));
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  return new Response(new Uint8Array(await workbook.xlsx.writeBuffer()), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": "attachment; filename=tnp-import-reference-values.xlsx",
    "Cache-Control": "private, no-store",
  } });
}
