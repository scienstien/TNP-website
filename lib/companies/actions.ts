"use server";

import { and, eq, isNotNull, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { companies, placementOffers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { validateCompanyUpdate } from "./validation";
import type { CompanyResult } from "./types";

export async function updateCompany(name: unknown, input: unknown): Promise<CompanyResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  if (user.role !== "ADMIN") return { error: "Only administrators can edit companies." };
  if (typeof name !== "string" || name.trim().length < 2 || name.length > 120) {
    return { error: "Unknown company." };
  }
  const normalizedName = name.trim().replace(/\s+/gu, " ");
  const parsed = validateCompanyUpdate(input, normalizedName);
  if (Object.keys(parsed.fieldErrors).length) return { fieldErrors: parsed.fieldErrors };
  if (parsed.data.visitDate) {
    const conflict = await db.select({ studentRollNumber: placementOffers.studentRollNumber })
      .from(placementOffers)
      .where(and(eq(placementOffers.companyName, normalizedName), isNotNull(placementOffers.offerDate), lt(placementOffers.offerDate, parsed.data.visitDate)))
      .limit(1);
    if (conflict.length) return { fieldErrors: { visitDate: "Visit date cannot be after an existing offer date for this company." } };
  }
  try {
    const [row] = await db.update(companies).set(parsed.data).where(eq(companies.name, normalizedName)).returning();
    if (!row) return { error: "This company no longer exists. Refresh and try again." };
    revalidatePath("/", "layout");
    return { ok: true, company: {
      name: row.name, domain: row.domain, hrName: row.hrName, email: row.email,
      phoneNumber: row.phoneNumber, pvrStatus: row.pvrStatus === true ? "yes" : row.pvrStatus === false ? "no" : "unknown", visitDate: row.visitDate,
    } };
  } catch {
    return { error: "Unable to save company changes. Please retry." };
  }
}
