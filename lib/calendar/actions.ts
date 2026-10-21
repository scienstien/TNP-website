"use server";

import { and, eq, isNotNull, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { companies, placementOffers } from "@/db/schema";
import { setVisitDate } from "@/lib/companies/visit";
import { findCycleId } from "@/lib/placements/cycles";
import { batchYearForDate } from "@/lib/placements/year-to-date";
import { todayInInstituteZone } from "./dates";
import { getCurrentUser, isAdminRole } from "@/lib/auth/dal";
import { validateCompanyUpdate } from "@/lib/companies/validation";

export interface VisitFormState {
  ok?: boolean;
  /** Submitted values, echoed back because React resets form fields after an action. */
  values?: Partial<
    Record<
      "company" | "visitDate" | "sector" | "hrName" | "phoneNumber" | "email",
      string
    >
  >;
  error?: string;
  fieldErrors?: Partial<
    Record<
      "company" | "visitDate" | "email" | "phoneNumber" | "hrName" | "sector",
      string
    >
  >;
}

const clean = (value: FormDataEntryValue | null, max: number) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);

/** Every change is authorised here on the server; hiding the buttons is not access control. */
async function requireAdmin(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Your session has expired. Sign in again.";
  if (!isAdminRole(user.role))
    return "Only administrators can change the calendar.";
  return null;
}

/**
 * Schedules (or reschedules / edits) a company's campus visit. An unknown company is
 * created; for a known one the contact fields are updated with what the form holds.
 */
export async function saveVisit(
  _previous: VisitFormState,
  formData: FormData,
): Promise<VisitFormState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const company = clean(formData.get("company"), 120);
  const visitDate = clean(formData.get("visitDate"), 10);
  const sector = clean(formData.get("sector"), 80);
  const hrName = clean(formData.get("hrName"), 100);
  const phoneNumber = clean(formData.get("phoneNumber"), 30);
  const email = clean(formData.get("email"), 254).toLowerCase();

  const values = { company, visitDate, sector, hrName, phoneNumber, email };
  const fieldErrors: VisitFormState["fieldErrors"] = {};
  if (company.length < 2) fieldErrors.company = "Enter the company name.";
  const parsed = validateCompanyUpdate(
    { domain: sector, hrName, phoneNumber, email, visitDate },
    company,
  );
  Object.assign(fieldErrors, parsed.fieldErrors);
  if (Object.keys(fieldErrors).length > 0) return { values, fieldErrors };

  const batchYear = batchYearForDate(todayInInstituteZone());
  const cycleId = await findCycleId(db, batchYear);
  const conflictingOffer = cycleId
    ? await db
        .select({ offerId: placementOffers.offerId })
        .from(placementOffers)
        .innerJoin(companies, eq(companies.companyId, placementOffers.companyId))
        .where(and(
          eq(companies.name, company),
          eq(placementOffers.cycleId, cycleId),
          isNotNull(placementOffers.offerDate),
          lt(placementOffers.offerDate, visitDate),
        ))
        .limit(1)
    : [];
  if (conflictingOffer.length) {
    return {
      values,
      fieldErrors: {
        visitDate: "Visit date cannot be after an existing offer date for this company.",
      },
    };
  }

  const record = {
    domain: parsed.data.domain,
    hrName: parsed.data.hrName,
    phoneNumber: parsed.data.phoneNumber,
    email: parsed.data.email,
  };

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(companies)
      .values({ name: company, ...record })
      .onConflictDoUpdate({ target: companies.name, set: record })
      .returning({ companyId: companies.companyId });
    await setVisitDate(tx, row.companyId, batchYear, parsed.data.visitDate);
  });

  revalidatePath("/");
  return { ok: true };
}

/**
 * Removes a visit from the calendar. Only the date is cleared (the company's PPT events become
 * unscheduled): the company, its contacts and any placement offers stay, because historical
 * offers depend on the company.
 */
export async function deleteVisit(company: string): Promise<VisitFormState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };
  if (
    typeof company !== "string" ||
    company.length === 0 ||
    company.length > 120
  )
    return { error: "Unknown company." };

  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ companyId: companies.companyId })
      .from(companies)
      .where(eq(companies.name, company));
    if (row) await setVisitDate(tx, row.companyId, batchYearForDate(todayInInstituteZone()), null);
  });
  revalidatePath("/");
  return { ok: true };
}
