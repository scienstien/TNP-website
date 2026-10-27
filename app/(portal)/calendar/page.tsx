import { Suspense } from "react";
import CalendarView from "@/components/calendar/CalendarView";
import { db } from "@/db";
import { isAdminRole, requireUser, resolveDepartment } from "@/lib/auth/dal";
import { addDays, isValidIsoDate, todayInInstituteZone } from "@/lib/calendar/dates";
import { getCalendarData } from "@/lib/calendar/queries";
import { monthWindow } from "@/lib/calendar/rules";
import { UPCOMING_MAX_DAYS } from "@/lib/calendar/upcoming";
import { readDriveOptions } from "@/lib/drives/read";

export default function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string | string[]; day?: string | string[] }> }) {
  return <Suspense fallback={<p role="status">Loading calendar…</p>}><CalendarData searchParams={searchParams} /></Suspense>;
}

async function CalendarData({ searchParams }: { searchParams: Promise<{ month?: string | string[]; day?: string | string[] }> }) {
  const user = await requireUser();
  const department = await resolveDepartment(user);
  const canEdit = isAdminRole(user.role) && department !== null;
  const today = todayInInstituteZone();
  const params = await searchParams;
  const window = monthWindow(typeof params.month === "string" ? params.month : "", today);
  // ?day= preselects a date inside the shown month (used when jumping from the upcoming list).
  const day = typeof params.day === "string" && isValidIsoDate(params.day) && params.day >= window.startsOn && params.day <= window.endsOn ? params.day : null;
  const [events, upcoming, drives] = await Promise.all([
    getCalendarData(window),
    // Dated stages from today up to the longest upcoming range, whatever month is shown.
    getCalendarData({ startsOn: today, endsOn: addDays(today, UPCOMING_MAX_DAYS) }).then(rows => rows.filter(event => event.scheduledDate !== null)),
    canEdit ? readDriveOptions(db, {}) : Promise.resolve([]),
  ]);
  return <CalendarView today={today} initialDay={day} canEdit={canEdit} scope={department?.code ?? "all"} window={window} events={events} upcoming={upcoming} drives={drives} />;
}
