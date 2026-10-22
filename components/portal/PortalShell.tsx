import type { ReactNode } from "react";
import DepartmentNavbar, {
  type DepartmentOption,
} from "@/components/dashboard/DepartmentNavbar";
import PortalSidebar from "./PortalSidebar";
import type { DashboardUser, PortalRole } from "./types";

export default function PortalShell({
  user,
  departments,
  children,
}: {
  user: DashboardUser;
  departments: DepartmentOption[];
  children: ReactNode;
}) {
  const isSuper = user.role === "SUPERADMIN";
  const role: PortalRole = user.role === "PROFESSOR" ? "Professor" : "Admin";

  return (
    <main className="portal-shell">
      <PortalSidebar user={user} role={role} isSuper={isSuper} />
      <section className="content-area">
        <DepartmentNavbar
          current={user.department}
          departments={departments}
          canSwitch={isSuper}
        />
        {children}
      </section>
    </main>
  );
}
