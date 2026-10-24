import "server-only";
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { companies, driveEvents, driveRoles, drives, eventRoles, placementCycles } from "@/db/schema";
import type { Database, Transaction } from "@/lib/placements/cycles";
import type { CalendarEvent, CalendarWindow } from "./types";

/** Internal reader; every caller authorizes first. Role links use a separate query. */
export async function readCalendarEvents(connection: Database | Transaction, filter: CalendarWindow | { eventId: string } | { companyId: string; cycleId: string; driveId: string } | { companyId: string }): Promise<CalendarEvent[]> {
  const condition = "eventId" in filter ? eq(driveEvents.eventId, filter.eventId) : "driveId" in filter
    ? and(eq(drives.driveId, filter.driveId), eq(drives.companyId, filter.companyId), eq(drives.cycleId, filter.cycleId))
    : "companyId" in filter ? eq(drives.companyId, filter.companyId)
    : or(isNull(driveEvents.scheduledDate), and(gte(driveEvents.scheduledDate, filter.startsOn), lte(driveEvents.scheduledDate, filter.endsOn)));
  const events = await connection.select({ eventId: driveEvents.eventId, driveId: drives.driveId, companyId: companies.companyId, companyName: companies.name, cycleId: drives.cycleId, cycleCode: placementCycles.code, driveReference: drives.reference, processType: driveEvents.processType, scheduledDate: driveEvents.scheduledDate, scope: driveEvents.scope, label: driveEvents.label })
    .from(driveEvents).innerJoin(drives, eq(drives.driveId, driveEvents.driveId)).innerJoin(companies, eq(companies.companyId, drives.companyId)).innerJoin(placementCycles, eq(placementCycles.cycleId, drives.cycleId))
    .where(condition).orderBy(sql`${driveEvents.scheduledDate} asc nulls last`, asc(companies.name), asc(driveEvents.eventId));
  if (!events.length) return [];
  const links = await connection.select({ eventId: eventRoles.eventId, roleId: driveRoles.roleId, jobTitle: driveRoles.jobTitle, domain: driveRoles.domain }).from(eventRoles)
    .innerJoin(driveRoles, and(eq(driveRoles.roleId, eventRoles.roleId), eq(driveRoles.driveId, eventRoles.driveId)))
    .where(inArray(eventRoles.eventId, events.map(event => event.eventId)))
    .orderBy(sql`${driveRoles.jobTitle} asc nulls last`, asc(driveRoles.roleId));
  const roles = new Map<string, CalendarEvent["roles"]>();
  for (const link of links) {
    const selected = roles.get(link.eventId) ?? [];
    selected.push({ roleId: link.roleId, jobTitle: link.jobTitle, domain: link.domain });
    roles.set(link.eventId, selected);
  }
  return events.map(event => ({ ...event, roles: roles.get(event.eventId) ?? [] }));
}
