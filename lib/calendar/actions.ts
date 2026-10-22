"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { driveEvents, driveRoles, eventRoles } from "@/db/schema";
import { assertSnapshot, isUuid } from "@/lib/drives/rules";
import { authorizeHistoricalWrite, lockDrive, writeError } from "@/lib/drives/write";
import type { Transaction } from "@/lib/placements/cycles";
import { readCalendarEvents } from "./read";
import { assertRoleMembership, validateEvent } from "./rules";
import type { EventInput, EventResult } from "./types";

async function validateLinks(tx: Transaction, data: EventInput) {
  const roles = data.roleIds.length ? await tx.select({ roleId: driveRoles.roleId, driveId: driveRoles.driveId }).from(driveRoles).where(inArray(driveRoles.roleId, data.roleIds)) : [];
  assertRoleMembership(data.roleIds, roles, data.driveId);
}

async function insertLinks(tx: Transaction, eventId: string, data: EventInput) {
  if (data.roleIds.length) await tx.insert(eventRoles).values(data.roleIds.map(roleId => ({ eventId, roleId, driveId: data.driveId })));
}

export async function createEvent(input: unknown): Promise<EventResult> {
  const error = await authorizeHistoricalWrite();
  if (error) return { error };
  try {
    const data = validateEvent(input);
    await db.transaction(async tx => {
      await lockDrive(tx, data.driveId);
      await validateLinks(tx, data);
      const fields = { driveId: data.driveId, processType: data.processType, scheduledDate: data.scheduledDate, scope: data.scope, label: data.label };
      const [event] = await tx.insert(driveEvents).values(fields).returning({ eventId: driveEvents.eventId });
      await insertLinks(tx, event.eventId, data);
    });
    revalidatePath("/", "layout"); return { ok: true };
  } catch (error) { return { error: writeError(error, "The drive or one of its roles no longer exists. Reload and try again.") }; }
}

async function changeEvent(eventId: unknown, input: unknown, expected: unknown, deleting: boolean): Promise<EventResult> {
  const error = await authorizeHistoricalWrite();
  if (error) return { error };
  if (!isUuid(eventId)) return { error: "Unknown event." };
  try {
    const data = deleting ? null : validateEvent(input);
    await db.transaction(async tx => {
      const [parent] = await tx.select({ driveId: driveEvents.driveId }).from(driveEvents).where(eq(driveEvents.eventId, eventId));
      if (!parent) throw new Error("This event no longer exists.");
      await lockDrive(tx, parent.driveId);
      const [locked] = await tx.select().from(driveEvents).where(eq(driveEvents.eventId, eventId)).for("update");
      if (!locked || locked.driveId !== parent.driveId) throw new Error("This event changed. Reopen it to load the latest values.");
      const [current] = await readCalendarEvents(tx, { eventId });
      assertSnapshot(current, expected, "event");
      if (deleting) {
        await tx.delete(eventRoles).where(eq(eventRoles.eventId, eventId));
        await tx.delete(driveEvents).where(eq(driveEvents.eventId, eventId));
      } else if (data) {
        if (data.driveId !== parent.driveId) throw new Error("An event cannot move to another drive. Delete and recreate it.");
        await validateLinks(tx, data);
        const fields = { processType: data.processType, scheduledDate: data.scheduledDate, scope: data.scope, label: data.label };
        await tx.update(driveEvents).set(fields).where(eq(driveEvents.eventId, eventId));
        await tx.delete(eventRoles).where(eq(eventRoles.eventId, eventId));
        await insertLinks(tx, eventId, data);
      }
    });
    revalidatePath("/", "layout"); return { ok: true };
  } catch (error) { return { error: writeError(error, "The drive or one of its roles no longer exists. Reload and try again.") }; }
}

export async function updateEvent(eventId: unknown, input: unknown, expected: unknown): Promise<EventResult> { return changeEvent(eventId, input, expected, false); }
export async function deleteEvent(eventId: unknown, expected: unknown): Promise<EventResult> { return changeEvent(eventId, null, expected, true); }
