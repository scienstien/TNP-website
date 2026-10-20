"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { isValidIsoDate } from "./dates";

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
const orNull = (value: string) => (value === "" ? null : value);

/** Every change is authorised here on the server; hiding the buttons is not access control. */
async function requireAdmin(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Your session has expired. Sign in again.";
  if (user.role !== "ADMIN")
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
  if (!isValidIsoDate(visitDate))
    fieldErrors.visitDate = "Choose a valid date.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fieldErrors.email = "Enter a valid email address.";
  if (phoneNumber && !/^[+\d][\d\s().-]{5,}$/.test(phoneNumber))
    fieldErrors.phoneNumber = "Enter a valid phone number.";
  if (Object.keys(fieldErrors).length > 0) return { values, fieldErrors };

  const record = {
    domain: orNull(sector),
    hrName: orNull(hrName),
    phoneNumber: orNull(phoneNumber),
    email: orNull(email),
    visitDate,
  };

  await db
    .insert(companies)
    .values({ name: company, ...record })
    .onConflictDoUpdate({ target: companies.name, set: record });

  revalidatePath("/");
  return { ok: true };
}

/**
 * Removes a visit from the calendar. Only the date is cleared: the company, its contacts
 * and any placement offers stay, because historical offers depend on the company.
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

  await db
    .update(companies)
    .set({ visitDate: null })
    .where(eq(companies.name, company));
  revalidatePath("/");
  return { ok: true };
}
