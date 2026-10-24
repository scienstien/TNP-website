import { addDays } from "./dates";
import type { CalendarEvent } from "./types";

/** The range choices of the upcoming-companies toggle, in days after today. */
export const UPCOMING_RANGES = [5, 10, 15, 20, 25, 30] as const;
export type UpcomingRange = (typeof UPCOMING_RANGES)[number];
export const UPCOMING_MAX_DAYS = UPCOMING_RANGES[UPCOMING_RANGES.length - 1];

export interface UpcomingCompany {
  companyId: string;
  companyName: string;
  /** This company's dated stages in the range, earliest first. */
  events: CalendarEvent[];
}

export interface UpcomingSummary {
  /** Inclusive: today through today + range days. */
  startsOn: string;
  endsOn: string;
  companies: UpcomingCompany[];
  stageCount: number;
}

/**
 * Companies with at least one dated drive stage from today through the next `range` days,
 * ordered by their first stage. Undated stages never count: no date is inferred.
 */
export function upcomingCompanies(events: CalendarEvent[], today: string, range: number): UpcomingSummary {
  const endsOn = addDays(today, range);
  const inRange = events
    .filter((event): event is CalendarEvent & { scheduledDate: string } => event.scheduledDate !== null && event.scheduledDate >= today && event.scheduledDate <= endsOn)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.companyName.localeCompare(b.companyName) || a.eventId.localeCompare(b.eventId));
  const byCompany = new Map<string, UpcomingCompany>();
  for (const event of inRange) {
    const company = byCompany.get(event.companyId) ?? { companyId: event.companyId, companyName: event.companyName, events: [] };
    company.events.push(event);
    byCompany.set(event.companyId, company);
  }
  return { startsOn: today, endsOn, companies: [...byCompany.values()], stageCount: inRange.length };
}
