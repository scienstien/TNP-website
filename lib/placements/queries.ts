import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, placementOffers, students } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import type { PlacementRecord } from "./types";

/**
 * Every recorded student with their offer (if any) and the offering company's sector.
 * Requires a signed-in user. The left join keeps unplaced students; the unique
 * student_roll_number constraint guarantees at most one offer row per student, so the
 * join cannot double-count.
 */
export async function getPlacementRecords(): Promise<PlacementRecord[]> {
  await requireUser();

  const rows = await db
    .select({
      rollNumber: students.rollNumber,
      batchYear: students.batchYear,
      company: placementOffers.companyName,
      sector: companies.domain,
      packageLpa: placementOffers.packageLpa,
      offerType: placementOffers.offerType,
      offerDate: placementOffers.offerDate,
    })
    .from(students)
    .leftJoin(
      placementOffers,
      eq(placementOffers.studentRollNumber, students.rollNumber),
    )
    .leftJoin(companies, eq(companies.name, placementOffers.companyName))
    .orderBy(students.batchYear, students.rollNumber);

  return rows.map((row) => {
    const packageLpa = row.packageLpa === null ? null : Number(row.packageLpa);
    return {
      rollNumber: row.rollNumber,
      batchYear: row.batchYear,
      offer: row.company
        ? {
            company: row.company,
            sector: row.sector,
            packageLpa:
              packageLpa !== null && Number.isFinite(packageLpa)
                ? packageLpa
                : null,
            offerType: row.offerType,
            offerDate: row.offerDate,
          }
        : null,
    };
  });
}
