import type { DepartmentOption } from "@/components/dashboard/DepartmentNavbar";

export type PortalRole = "Professor" | "Admin";

export interface DashboardUser {
  name: string | null;
  email: string;
  role: "ADMIN" | "PROFESSOR" | "SUPERADMIN";
  /**
   * The department being shown: a department user's own, or the one a super admin chose.
   * null for a super admin viewing every department.
   */
  department: DepartmentOption | null;
}
