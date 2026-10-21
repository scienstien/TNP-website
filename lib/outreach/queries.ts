import "server-only";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { outreachContacts } from "@/db/schema";
import { requireUser, resolveDepartment } from "@/lib/auth/dal";
import type { OutreachRecord } from "./types";

export async function getOutreachContacts(): Promise<OutreachRecord[]> {
  const user = await requireUser();
  // A department sees its own contacts; a super admin with no department chosen sees them all.
  const department = await resolveDepartment(user);
  const rows = await db
    .select()
    .from(outreachContacts)
    .where(department ? eq(outreachContacts.departmentId, department.departmentId) : undefined)
    .orderBy(desc(outreachContacts.updatedAt));
  return rows.map(({ departmentId, ...row }) => {
    void departmentId;
    return { ...row, pvrStatus: row.pvrStatus ? "yes" : "no" };
  });
}
