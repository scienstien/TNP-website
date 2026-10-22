import PortalShell from "@/components/portal/PortalShell";
import type { DashboardUser } from "@/components/portal/types";
import { listDepartments, requireUser, resolveDepartment } from "@/lib/auth/dal";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [department, departments] = await Promise.all([
    resolveDepartment(user),
    user.role === "SUPERADMIN" ? listDepartments() : [],
  ]);
  const portalUser: DashboardUser = {
    name: user.name,
    email: user.email,
    role: user.role,
    department: department ? { code: department.code, name: department.name } : null,
  };

  return (
    <PortalShell
      user={portalUser}
      departments={departments.map(({ code, name }) => ({ code, name }))}
    >
      {children}
    </PortalShell>
  );
}
