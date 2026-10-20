import "server-only";

import { asc } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import type { CalendarData } from "./types";

/** Scheduled campus visits and the known company names. Requires a signed-in user. */
export async function getCalendarData(): Promise<CalendarData> {
  await requireUser();

  const rows = await db
    .select({
      company: companies.name,
      sector: companies.domain,
      hrName: companies.hrName,
      email: companies.email,
      phoneNumber: companies.phoneNumber,
      visitDate: companies.visitDate,
    })
    .from(companies)
    .orderBy(asc(companies.name));

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
