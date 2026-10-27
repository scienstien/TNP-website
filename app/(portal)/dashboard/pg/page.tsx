import { Suspense } from "react";
import PlacementAnalytics from "@/components/dashboard/PlacementAnalytics";
import { requireUser, resolveDepartment } from "@/lib/auth/dal";
import { todayInInstituteZone } from "@/lib/calendar/dates";
import { getPlacementRecords } from "@/lib/placements/queries";

export default function PostgraduateDashboardPage() {
  return <Suspense fallback={<p role="status">Loading PG dashboard…</p>}><PostgraduateDashboardData /></Suspense>;
}

async function PostgraduateDashboardData() {
  const user = await requireUser();
  const [department, records] = await Promise.all([
    resolveDepartment(user),
    getPlacementRecords("PG"),
  ]);
  const role = user.role === "PROFESSOR"
    ? "Professor"
    : user.role === "SUPERADMIN"
      ? "Super admin"
      : "Admin";
  return (
    <PlacementAnalytics
      key={department?.code ?? "all"}
      records={records}
      role={role}
      department={department ? { code: department.code, name: department.name } : null}
      today={todayInInstituteZone()}
      degreeLevel="PG"
    />
  );
}
