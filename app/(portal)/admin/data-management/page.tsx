import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { importHistory, users } from "@/db/schema";
import { requireRole, resolveDepartment } from "@/lib/auth/dal";
import ImportManager from "@/components/import/ImportManager";

async function DataManagement() {
  const user = await requireRole("ADMIN");
  const department = await resolveDepartment(user);
  const history = department ? await db.select({ id: importHistory.id, dataset: importHistory.dataset,
    createdAt: importHistory.createdAt, inserted: importHistory.inserted, updated: importHistory.updated,
    skipped: importHistory.skipped, actor: users.email, fileSha256: importHistory.fileSha256,
  }).from(importHistory).innerJoin(users, eq(users.id, importHistory.actorId))
    .where(eq(importHistory.departmentId, department.departmentId))
    .orderBy(desc(importHistory.createdAt)).limit(20) : [];
  return <ImportManager key={department?.departmentId ?? "all"} department={department?.name ?? null} history={history} />;
}
export default function DataManagementPage() {
  return <Suspense fallback={<p role="status">Loading data management…</p>}><DataManagement /></Suspense>;
}
