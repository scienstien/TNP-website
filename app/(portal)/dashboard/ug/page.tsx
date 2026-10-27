import { Suspense } from "react";
import PlacementAnalytics from "@/components/dashboard/PlacementAnalytics";
import { requireUser, resolveDepartment } from "@/lib/auth/dal";
import { todayInInstituteZone } from "@/lib/calendar/dates";
import { getPlacementRecords } from "@/lib/placements/queries";

export default function UndergraduateDashboardPage() {
  return <Suspense fallback={<p role="status">Loading UG dashboard…</p>}><UndergraduateDashboardData /></Suspense>;
}

async function UndergraduateDashboardData() {
  const user = await requireUser();
  const [department, records] = await Promise.all([
    resolveDepartment(user),
    getPlacementRecords(),
  ]);
  const role = user.role === "PROFESSOR"
    ? "Professor"
    : user.role === "SUPERADMIN"
      ? "Super admin"
      : "Admin";

  return (
    <PlacementAnalytics
      records={records}
      role={role}
      department={department ? { code: department.code, name: department.name } : null}
      today={todayInInstituteZone()}
      degreeLevel="UG"
    />
  );
}
