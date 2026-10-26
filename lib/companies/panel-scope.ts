import "server-only";

import { requireRole, resolveDepartment } from "@/lib/auth/dal";

export interface CompanyPanelScope {
  departmentId: string | null;
  scopeLabel: string;
}

/** Resolve every read from the authenticated user, never a client department ID. */
export async function requireCompanyPanelScope(): Promise<CompanyPanelScope> {
  const user = await requireRole("ADMIN");
  const department = await resolveDepartment(user);
  return {
    departmentId: department?.departmentId ?? null,
    scopeLabel: department?.name ?? "All departments",
  };
}
