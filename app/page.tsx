import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { getCalendarData } from "@/lib/calendar/queries";
import { todayInInstituteZone } from "@/lib/calendar/dates";
import { getPlacementRecords } from "@/lib/placements/queries";
import Dashboard from "./Dashboard";

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
  return (
    <Dashboard
      user={{ name: user.name, email: user.email, role: user.role }}
      placementRecords={placementRecords}
      calendar={calendar}
      today={todayInInstituteZone()}
    />
  );
}
