import CalendarView from "@/components/calendar/CalendarView";
import { db } from "@/db";
import { requireUser, resolveDepartment } from "@/lib/auth/dal";
import { todayInInstituteZone } from "@/lib/calendar/dates";
import { getCalendarData } from "@/lib/calendar/queries";
import { monthWindow } from "@/lib/calendar/rules";
import { readDriveOptions } from "@/lib/drives/read";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const user = await requireUser();
  const department = await resolveDepartment(user);
  const canEdit = user.role === "SUPERADMIN" && department !== null;
  const today = todayInInstituteZone();
  const params = await searchParams;
  const window = monthWindow(typeof params.month === "string" ? params.month : "", today);
  const [events, drives] = await Promise.all([getCalendarData(window), canEdit ? readDriveOptions(db, {}) : Promise.resolve([])]);
  return <CalendarView today={today} canEdit={canEdit} scope={department?.code ?? "all"} window={window} events={events} drives={drives} />;
}
