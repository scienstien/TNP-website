"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { outreachContacts } from "@/db/schema";
import { getCurrentUser, isAdminRole, resolveDepartment } from "@/lib/auth/dal";
import type { OutreachResult } from "./types";
import { validateOutreach } from "./validation";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The admin's department (or the super admin's chosen one), or the error to show instead. */
async function authorize() {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  if (!isAdminRole(user.role)) {
    return { error: "Only administrators can manage outreach contacts." };
  }
  const department = await resolveDepartment(user);
  if (!department) return { error: "Choose a department first." };
  return { departmentId: department.departmentId };
}

export async function createOutreachContact(
  input: unknown,
): Promise<OutreachResult> {
  const scope = await authorize();
  if ("error" in scope) return { error: scope.error };
  const parsed = validateOutreach(input);
  if (Object.keys(parsed.fieldErrors).length) {
    return { fieldErrors: parsed.fieldErrors };
  }
  try {
    await db.insert(outreachContacts).values({
      ...parsed.data,
      departmentId: scope.departmentId,
      pvrStatus: parsed.data.pvrStatus === "yes",
    });
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { error: "Unable to add the outreach contact. Please retry." };
  }
}

export async function updateOutreachContact(
  id: unknown,
  input: unknown,
): Promise<OutreachResult> {
  const scope = await authorize();
  if ("error" in scope) return { error: scope.error };
  if (typeof id !== "string" || !uuidPattern.test(id)) {
    return { error: "Unknown outreach entry." };
  }
  const parsed = validateOutreach(input);
  if (Object.keys(parsed.fieldErrors).length) {
    return { fieldErrors: parsed.fieldErrors };
  }
  try {
    const [updated] = await db
      .update(outreachContacts)
      .set({
        ...parsed.data,
        pvrStatus: parsed.data.pvrStatus === "yes",
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(outreachContacts.id, id), eq(outreachContacts.departmentId, scope.departmentId)))
      .returning({ id: outreachContacts.id });
    if (!updated) return { error: "This outreach entry no longer exists." };
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { error: "Unable to update the outreach contact. Please retry." };
  }
}

export async function deleteOutreachContact(
  id: unknown,
): Promise<OutreachResult> {
  const scope = await authorize();
  if ("error" in scope) return { error: scope.error };
  if (typeof id !== "string" || !uuidPattern.test(id)) {
    return { error: "Unknown outreach entry." };
  }
  try {
    const [deleted] = await db
      .delete(outreachContacts)
      .where(and(eq(outreachContacts.id, id), eq(outreachContacts.departmentId, scope.departmentId)))
      .returning({ id: outreachContacts.id });
    if (!deleted) return { error: "This outreach entry no longer exists." };
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { error: "Unable to delete the outreach contact. Please retry." };
  }
}
