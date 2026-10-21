import { Suspense } from "react";
import { isAdminRole, listDepartments, requireUser, resolveDepartment } from "@/lib/auth/dal";
import { todayInInstituteZone } from "@/lib/calendar/dates";
import { getPlacementRecords } from "@/lib/placements/queries";
import { batchYearForDate } from "@/lib/placements/year-to-date";
import Dashboard from "./Dashboard";
import { getStudentData } from "@/lib/students/queries";
import { getCompanies } from "@/lib/companies/queries";
import { getOutreachContacts } from "@/lib/outreach/queries";
import DashboardLoading from "@/components/dashboard/DashboardLoading";

// The dashboard needs a signed-in user; the role and department shown come from the database, not the client.
export default function Page() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <SignedInDashboard />
    </Suspense>
  );
}

async function SignedInDashboard() {
  const user = await requireUser();
  const today = todayInInstituteZone();
  const department = await resolveDepartment(user);
  const admin = isAdminRole(user.role);
  const [placementRecords, companies, outreachContacts, studentData, departments] = await Promise.all([
    getPlacementRecords(),
    admin ? getCompanies(batchYearForDate(today)) : [],
    getOutreachContacts(),
    admin ? getStudentData() : null,
    user.role === "SUPERADMIN" ? listDepartments() : [],
  ]);
  return (
    <Dashboard
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        department: department ? { code: department.code, name: department.name } : null,
      }}
      departments={departments.map(({ code, name }) => ({ code, name }))}
      placementRecords={placementRecords}
      companies={companies}
      outreachContacts={outreachContacts}
      studentData={studentData}
      today={today}
    />
  );
}
