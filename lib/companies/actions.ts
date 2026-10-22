"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { getCurrentUser, isAdminRole, resolveDepartment } from "@/lib/auth/dal";
import { pvrStatusFromDatabase, validateCompanyCreate, validateCompanyUpdate } from "./validation";
import type { CompanyRecord, CompanyResult } from "./types";

/** Only an administrator acting in a department (a super admin must have chosen one) may write. */
async function adminDepartment(action: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  if (!isAdminRole(user.role)) return { error: `Only administrators can ${action}.` };
  const department = await resolveDepartment(user);
  if (!department) return { error: "Choose a department first." };
  return { department };
}


async function readCompany(companyId: string): Promise<CompanyRecord | null> {
  const [row] = await db.select().from(companies).where(eq(companies.companyId, companyId));
  if (!row) return null;
  return {
    name: row.name,
    domain: row.domain,
    hrName: row.hrName,
    email: row.email,
    phoneNumber: row.phoneNumber,
    remarks: row.remarks,
    pvrStatus: pvrStatusFromDatabase(row.pvrStatus),
    visitDate: null,
  };
}

/** Create only the company; an existing name must never overwrite contacts. */
export async function createCompany(input: unknown): Promise<CompanyResult> {
  const scope = await adminDepartment("create companies");
  if ("error" in scope) return { error: scope.error };
  const parsed = validateCompanyCreate(input);
  if (Object.keys(parsed.fieldErrors).length) return { fieldErrors: parsed.fieldErrors };
  const fields = parsed.data;
  try {
    const companyId = await db.transaction(async (tx) => {
      const [row] = await tx.insert(companies).values(fields)
        .onConflictDoNothing({ target: companies.name })
        .returning({ companyId: companies.companyId });
      if (!row) return null;
      return row.companyId;
    });
    if (companyId === null) {
      return { fieldErrors: { name: "This company already exists. No existing details were changed." } };
    }
    revalidatePath("/", "layout");
    const company = await readCompany(companyId);
    return company ? { ok: true, company } : { error: "Unable to add the company. Please retry." };
  } catch {
    return { error: "Unable to add the company. Please retry." };
  }
}

export async function updateCompany(name: unknown, input: unknown): Promise<CompanyResult> {
  const scope = await adminDepartment("edit companies");
  if ("error" in scope) return { error: scope.error };
  if (typeof name !== "string" || name.trim().length < 2 || name.length > 120) {
    return { error: "Unknown company." };
  }
  const normalizedName = name.trim().replace(/\s+/gu, " ");
  const parsed = validateCompanyUpdate(input, normalizedName);
  if (Object.keys(parsed.fieldErrors).length) return { fieldErrors: parsed.fieldErrors };
  const [existing] = await db.select({ companyId: companies.companyId })
    .from(companies).where(eq(companies.name, normalizedName));
  if (!existing) return { error: "This company no longer exists. Refresh and try again." };
  const { companyId } = existing;
  const fields = parsed.data;
  try {
    await db.transaction(async (tx) => {
      await tx.update(companies).set(fields).where(eq(companies.companyId, companyId));
    });
    revalidatePath("/", "layout");
    const company = await readCompany(companyId);
    return company ? { ok: true, company } : { error: "This company no longer exists. Refresh and try again." };
  } catch {
    return { error: "Unable to save company changes. Please retry." };
  }
}
