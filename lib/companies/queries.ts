import "server-only";

import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, placementOffers } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { pvrStatusFromDatabase } from "./validation";
import type { CompanyRecord } from "./types";

export async function getCompanies(): Promise<CompanyRecord[]> {
  await requireUser();
  const rows = await db.select({
    name: companies.name,
    domain: companies.domain,
    hrName: companies.hrName,
    email: companies.email,
    phoneNumber: companies.phoneNumber,
    pvrStatus: companies.pvrStatus,
    visitDate: companies.visitDate,
    offerCount: count(placementOffers.studentRollNumber).mapWith(Number),
  }).from(companies)
    .leftJoin(placementOffers, eq(placementOffers.companyName, companies.name))
    .groupBy(companies.name)
    .orderBy(asc(companies.name));
  return rows.map((row) => ({
    name: row.name,
    domain: row.domain,
    hrName: row.hrName,
    email: row.email,
    phoneNumber: row.phoneNumber,
    pvrStatus: pvrStatusFromDatabase(row.pvrStatus),
    visitDate: row.visitDate,
    offerCount: row.offerCount,
  }));
}
