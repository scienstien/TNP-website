import "server-only";

import { asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { companies, placementOffers, students } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { pvrStatusFromDatabase } from "./validation";
import type { CompanyRecord } from "./types";

export async function getCompanies(batchYear: number): Promise<CompanyRecord[]> {
  await requireRole("ADMIN");
  const rows = await db.selectDistinct({
    name: companies.name,
    domain: companies.domain,
    hrName: companies.hrName,
    email: companies.email,
    phoneNumber: companies.phoneNumber,
    remarks: companies.remarks,
    pvrStatus: companies.pvrStatus,
    visitDate: companies.visitDate,
  }).from(companies)
    .leftJoin(placementOffers, eq(placementOffers.companyName, companies.name))
    .leftJoin(students, eq(students.rollNumber, placementOffers.studentRollNumber))
    .where(or(eq(students.batchYear, batchYear), isNull(placementOffers.studentRollNumber)))
    .orderBy(asc(companies.name));
  return rows.map((row) => ({
    name: row.name,
    domain: row.domain,
    hrName: row.hrName,
    email: row.email,
    phoneNumber: row.phoneNumber,
    remarks: row.remarks,
    pvrStatus: pvrStatusFromDatabase(row.pvrStatus),
    visitDate: row.visitDate,
  }));
}
