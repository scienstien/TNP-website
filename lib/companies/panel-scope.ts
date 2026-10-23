import "server-only";

import { notFound } from "next/navigation";
import { requireRole, resolveDepartment } from "@/lib/auth/dal";

export interface CompanyPanelScope {
  departmentId: string | null;
  scopeLabel: string;
}

/** Resolve every read from the authenticated user, never a client department ID. */
export async function requireCompanyPanelScope(): Promise<CompanyPanelScope> {
  const user = await requireRole("ADMIN");
  const department = await resolveDepartment(user);
  // A misconfigured department account must never become an institute-wide read.
  if (user.role !== "SUPERADMIN" && !department) notFound();
  return {
    departmentId: department?.departmentId ?? null,
    scopeLabel: department?.name ?? "All departments",
  };
}
