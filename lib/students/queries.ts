import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, placementOffers, students } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import type { StudentData } from "./types";

export async function getStudentData(): Promise<StudentData> {
  await requireRole("ADMIN");
  const [rows, companyRows] = await Promise.all([
    db.select({ student: students, offer: placementOffers }).from(students)
      .leftJoin(placementOffers, eq(students.rollNumber, placementOffers.studentRollNumber))
      .orderBy(students.batchYear, students.rollNumber),
    db.select({ name: companies.name, domain: companies.domain, visitDate: companies.visitDate })
      .from(companies).orderBy(companies.name),
  ]);
  return {
    companies: companyRows,
    students: rows.map(({ student, offer }) => ({ ...student, offer: offer ? {
      companyName: offer.companyName, jobRole: offer.jobRole, packageLpa: offer.packageLpa,
      offerType: offer.offerType, offerDate: offer.offerDate,
    } : null })),
  };
}
