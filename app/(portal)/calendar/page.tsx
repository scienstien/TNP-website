import CalendarView from "@/components/calendar/CalendarView";
import { requireUser, resolveDepartment } from "@/lib/auth/dal";
import { todayInInstituteZone } from "@/lib/calendar/dates";

export default async function CalendarPage() {
  const user = await requireUser();
  const department = await resolveDepartment(user);

  return (
    <CalendarView
      today={todayInInstituteZone()}
      isAdmin={user.role !== "PROFESSOR"}
      scope={department?.code ?? "all"}
    />
  );
}
