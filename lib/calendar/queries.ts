import "server-only";

import { asc } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { visitDatesByCompany } from "@/lib/companies/visit";
import { findCycleId } from "@/lib/placements/cycles";
import { batchYearForDate } from "@/lib/placements/year-to-date";
import { todayInInstituteZone } from "./dates";
import type { CalendarData } from "./types";

/**
 * Scheduled campus visits (the earliest PPT drive event of each company in the current placement
 * cycle) and the known company names. Requires a signed-in user.
 */
export async function getCalendarData(): Promise<CalendarData> {
  await requireUser();

  const cycleId = await findCycleId(db, batchYearForDate(todayInInstituteZone()));
  const [companyRows, visitDates] = await Promise.all([
    db
      .select({
        companyId: companies.companyId,
        company: companies.name,
        sector: companies.domain,
        hrName: companies.hrName,
        email: companies.email,
        phoneNumber: companies.phoneNumber,
      })
      .from(companies)
      .orderBy(asc(companies.name)),
    visitDatesByCompany(db, cycleId),
  ]);
  const rows = companyRows.map(({ companyId, ...row }) => ({
    ...row,
    visitDate: visitDates.get(companyId) ?? null,
  }));

  return {
    visits: rows
      .filter(
        (row): row is typeof row & { visitDate: string } =>
          row.visitDate !== null,
      )
      .sort(
        (a, b) =>
          a.visitDate.localeCompare(b.visitDate) ||
          a.company.localeCompare(b.company),
      ),
    companyNames: rows.map((row) => row.company),
  };
}
