"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { companies, placementCycles } from "@/db/schema";
import { getCurrentUser, isAdminRole, resolveDepartment } from "@/lib/auth/dal";
import { validateDriveCycleCode, validateNewCompanyDrives } from "@/lib/drives/rules";
import { insertDriveWithRoles } from "@/lib/drives/write";
import { validateCompanyCreate, validateCompanyUpdate } from "./validation";
import { companyRecord, companySnapshotMatches, isUuid } from "./records";
import type { CompanyResult } from "./types";

/** Only an administrator acting in a department (a super admin must have chosen one) may write. */
async function adminDepartment(action: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  if (!isAdminRole(user.role)) return { error: `Only administrators can ${action}.` };
  const department = await resolveDepartment(user);
  if (!department) return { error: "Choose a department first." };
  return { department };
}


/**
 * Create the company and any drafted drives (with their roles) in one transaction;
 * an existing name must never overwrite contacts, and then no drive is created either.
 */
export async function createCompany(input: unknown): Promise<CompanyResult> {
  const scope = await adminDepartment("create companies");
  if ("error" in scope) return { error: scope.error };
  const { drives: driveInput, ...companyInput } = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const parsed = validateCompanyCreate(companyInput);
  if (Object.keys(parsed.fieldErrors).length) return { fieldErrors: parsed.fieldErrors };
  let newDrives: ReturnType<typeof validateNewCompanyDrives>;
  try { newDrives = validateNewCompanyDrives(driveInput); }
  catch (error) { return { fieldErrors: { form: error instanceof Error ? error.message : "Invalid drive data." } }; }
  const fields = parsed.data;
  try {
    const company = await db.transaction(async (tx) => {
      const [row] = await tx.insert(companies).values(fields)
        .onConflictDoNothing({ target: companies.name })
        .returning({ companyId: companies.companyId });
      if (!row) return null;
      const cycleIds = [...new Set(newDrives.map(drive => drive.cycleId))];
      if (cycleIds.length) {
        const found = await tx.select({ cycleId: placementCycles.cycleId, code: placementCycles.code }).from(placementCycles).where(inArray(placementCycles.cycleId, cycleIds));
        if (found.length !== cycleIds.length) throw new Error(missingCycle);
        found.forEach(cycle => validateDriveCycleCode(cycle.code));
      }
      for (const drive of newDrives) await insertDriveWithRoles(tx, { companyId: row.companyId, ...drive });
      const [created] = await tx.select().from(companies).where(eq(companies.companyId, row.companyId));
      return companyRecord(created);
    });
    if (company === null) {
      return { fieldErrors: { name: "This company already exists. No existing details were changed." } };
    }
    revalidatePath("/", "layout");
    return company ? { ok: true, company } : { error: "Unable to add the company. Please retry." };
  } catch (error) {
    return { error: error instanceof Error && error.message === missingCycle ? missingCycle : "Unable to add the company. Please retry." };
  }
}

const missingCycle = "A chosen placement cycle no longer exists. Reload and try again.";

export async function updateCompany(companyId: unknown, input: unknown, expected: unknown): Promise<CompanyResult> {
  const scope = await adminDepartment("edit companies");
  if ("error" in scope) return { error: scope.error };
  if (!isUuid(companyId)) return { error: "Unknown company." };
  const parsed = validateCompanyUpdate(input, "");
  if (Object.keys(parsed.fieldErrors).length) return { fieldErrors: parsed.fieldErrors };
  try {
    const result = await db.transaction(async (tx): Promise<CompanyResult> => {
      const [existing] = await tx.select().from(companies).where(eq(companies.companyId, companyId)).for("update");
      if (!existing) return { error: "This company no longer exists. Refresh and try again." };
      if (!companySnapshotMatches(companyRecord(existing), expected)) return { error: "This company changed. Reopen it to load the latest values." };
      const [updated] = await tx.update(companies).set(parsed.data).where(eq(companies.companyId, companyId)).returning();
      return { ok: true, company: companyRecord(updated) };
    });
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch {
    return { error: "Unable to save company changes. Please retry." };
  }
}
