import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { getCalendarData } from "@/lib/calendar/queries";
import { todayInInstituteZone } from "@/lib/calendar/dates";
import { getPlacementRecords } from "@/lib/placements/queries";
import Dashboard from "./Dashboard";
import { getStudentData } from "@/lib/students/queries";

// The dashboard needs a signed-in user; the role shown comes from the database, not the client.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignedInDashboard />
    </Suspense>
  );
}

async function SignedInDashboard() {
  const [user, placementRecords, calendar] = await Promise.all([
    requireUser(),
    getPlacementRecords(),
    getCalendarData(),
  ]);
  const studentData = user.role === "ADMIN" ? await getStudentData() : null;
  return (
    <Dashboard
      user={{ name: user.name, email: user.email, role: user.role }}
      placementRecords={placementRecords}
      calendar={calendar}
      studentData={studentData}
      today={todayInInstituteZone()}
    />
  );
}
