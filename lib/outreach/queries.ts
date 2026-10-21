import "server-only";

import { desc } from "drizzle-orm";
import { db } from "@/db";
import { outreachContacts } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import type { OutreachRecord } from "./types";

export async function getOutreachContacts(): Promise<OutreachRecord[]> {
  await requireUser();
  const rows = await db
    .select()
    .from(outreachContacts)
    .orderBy(desc(outreachContacts.updatedAt));
  return rows.map((row) => ({
    ...row,
    pvrStatus: row.pvrStatus ? "yes" : "no",
  }));
}
