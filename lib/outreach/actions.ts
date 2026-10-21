"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { outreachContacts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import type { OutreachResult } from "./types";
import { validateOutreach } from "./validation";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorize(): Promise<OutreachResult | null> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  if (user.role !== "ADMIN") {
    return { error: "Only administrators can manage outreach contacts." };
  }
  return null;
}

export async function createOutreachContact(
  input: unknown,
): Promise<OutreachResult> {
  const denied = await authorize();
  if (denied) return denied;
  const parsed = validateOutreach(input);
  if (Object.keys(parsed.fieldErrors).length) {
    return { fieldErrors: parsed.fieldErrors };
  }
  try {
    await db.insert(outreachContacts).values({
      ...parsed.data,
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
  const denied = await authorize();
  if (denied) return denied;
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
      .where(eq(outreachContacts.id, id))
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
  const denied = await authorize();
  if (denied) return denied;
  if (typeof id !== "string" || !uuidPattern.test(id)) {
    return { error: "Unknown outreach entry." };
  }
  try {
    const [deleted] = await db
      .delete(outreachContacts)
      .where(eq(outreachContacts.id, id))
      .returning({ id: outreachContacts.id });
    if (!deleted) return { error: "This outreach entry no longer exists." };
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { error: "Unable to delete the outreach contact. Please retry." };
  }
}
