import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { todayInInstituteZone } from "@/lib/calendar/dates";
import { getPlacementRecords } from "@/lib/placements/queries";
import Dashboard from "./Dashboard";
import { getStudentData } from "@/lib/students/queries";
import { getCompanies } from "@/lib/companies/queries";
import { getOutreachContacts } from "@/lib/outreach/queries";
import DashboardLoading from "@/components/dashboard/DashboardLoading";

// The dashboard needs a signed-in user; the role shown comes from the database, not the client.
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
  const currentBatchYear = Number(today.slice(0, 4));
  const placementRecords = await getPlacementRecords();
  const companies = user.role === "ADMIN"
    ? await getCompanies(currentBatchYear)
    : [];
  const outreachContacts = await getOutreachContacts();
  const studentData = user.role === "ADMIN" ? await getStudentData() : null;
  return (
    <Dashboard
      user={{ name: user.name, email: user.email, role: user.role }}
      placementRecords={placementRecords}
      companies={companies}
      outreachContacts={outreachContacts}
      studentData={studentData}
      today={today}
    />
  );
}
