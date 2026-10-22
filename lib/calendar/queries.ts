import "server-only";
import { db } from "@/db";
import { requireUser, resolveDepartment } from "@/lib/auth/dal";
import { isValidIsoDate } from "./dates";
import { readCalendarEvents } from "./read";
import type { CalendarEvent, CalendarWindow } from "./types";

/** Institute-wide stages have no department targeting; every signed-in user may read. */
export async function getCalendarData(window: CalendarWindow): Promise<CalendarEvent[]> {
  const user = await requireUser();
  await resolveDepartment(user);
  if (!isValidIsoDate(window.startsOn) || !isValidIsoDate(window.endsOn) || window.startsOn > window.endsOn) return [];
  return readCalendarEvents(db, window);
}
