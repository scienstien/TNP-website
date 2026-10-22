"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { companies, driveEvents, driveRoles, drives, eventRoles, placementCycles, placementOffers } from "@/db/schema";
import { readDriveOptions } from "./read";
import { assertSnapshot, isUuid, validateDrive, validateRole } from "./rules";
import { authorizeHistoricalWrite, lockDrive, writeError } from "./write";
import type { DriveResult } from "./types";

const driveReferenced = "This drive is referenced by a role, event or offer. Remove those references first.";
const roleReferenced = "This role is referenced by an event or offer. Remove those references first.";
const refresh = () => revalidatePath("/", "layout");

export async function createDrive(input: unknown): Promise<DriveResult> {
  const error = await authorizeHistoricalWrite();
  if (error) return { error };
  try {
    const data = validateDrive(input, true);
    await db.transaction(async tx => {
      const [company] = await tx.select().from(companies).where(eq(companies.companyId, data.companyId));
      const [cycle] = await tx.select().from(placementCycles).where(eq(placementCycles.cycleId, data.cycleId));
      if (!company || !cycle) throw new Error("Choose an existing company and placement cycle.");
      await tx.insert(drives).values(data);
    });
    refresh(); return { ok: true };
  } catch (error) { return { error: writeError(error, "The company or cycle no longer exists.") }; }
}

export async function updateDrive(driveId: unknown, input: unknown, expected: unknown): Promise<DriveResult> {
  const error = await authorizeHistoricalWrite();
  if (error) return { error };
  if (!isUuid(driveId)) return { error: "Unknown drive." };
  try {
    const { reference } = validateDrive(input, false);
    await db.transaction(async tx => {
      const drive = await lockDrive(tx, driveId);
      const current = (await readDriveOptions(tx, { companyId: drive.companyId, cycleId: drive.cycleId })).find(row => row.driveId === driveId);
      assertSnapshot(current, expected, "drive");
      await tx.update(drives).set({ reference }).where(eq(drives.driveId, driveId));
    });
    refresh(); return { ok: true };
  } catch (error) { return { error: writeError(error, driveReferenced) }; }
}

export async function deleteDrive(driveId: unknown, expected: unknown): Promise<DriveResult> {
  const error = await authorizeHistoricalWrite();
  if (error) return { error };
  if (!isUuid(driveId)) return { error: "Unknown drive." };
  try {
    await db.transaction(async tx => {
      const drive = await lockDrive(tx, driveId);
      const current = (await readDriveOptions(tx, { companyId: drive.companyId, cycleId: drive.cycleId })).find(row => row.driveId === driveId);
      assertSnapshot(current, expected, "drive");
      const roles = await tx.select({ id: driveRoles.roleId }).from(driveRoles).where(eq(driveRoles.driveId, driveId));
      const events = await tx.select({ id: driveEvents.eventId }).from(driveEvents).where(eq(driveEvents.driveId, driveId));
      const offers = await tx.select({ id: placementOffers.offerId }).from(placementOffers).where(eq(placementOffers.driveId, driveId));
      if (roles.length || events.length || offers.length) throw new Error(driveReferenced);
      await tx.delete(drives).where(eq(drives.driveId, driveId));
    });
    refresh(); return { ok: true };
  } catch (error) { return { error: writeError(error, driveReferenced) }; }
}

export async function createRole(input: unknown): Promise<DriveResult> {
  const error = await authorizeHistoricalWrite();
  if (error) return { error };
  try {
    const data = validateRole(input, true);
    await db.transaction(async tx => { await lockDrive(tx, data.driveId); await tx.insert(driveRoles).values(data); });
    refresh(); return { ok: true };
  } catch (error) { return { error: writeError(error, "This drive no longer exists.") }; }
}

async function changeRole(roleId: unknown, input: unknown, expected: unknown, deleting: boolean): Promise<DriveResult> {
  const error = await authorizeHistoricalWrite();
  if (error) return { error };
  if (!isUuid(roleId)) return { error: "Unknown role." };
  try {
    const { jobTitle } = validateRole(input, false);
    await db.transaction(async tx => {
      const [parent] = await tx.select({ driveId: driveRoles.driveId }).from(driveRoles).where(eq(driveRoles.roleId, roleId));
      if (!parent) throw new Error("This role no longer exists.");
      await lockDrive(tx, parent.driveId);
      const [role] = await tx.select().from(driveRoles).where(eq(driveRoles.roleId, roleId)).for("update");
      if (!role || role.driveId !== parent.driveId) throw new Error("This role changed. Reopen it to load the latest values.");
      assertSnapshot({ roleId: role.roleId, jobTitle: role.jobTitle }, expected, "role");
      if (deleting) {
        const offers = await tx.select({ id: placementOffers.offerId }).from(placementOffers).where(eq(placementOffers.roleId, roleId));
        const links = await tx.select().from(eventRoles).where(eq(eventRoles.roleId, roleId));
        if (offers.length || links.length) throw new Error(roleReferenced);
        await tx.delete(driveRoles).where(eq(driveRoles.roleId, roleId));
      } else await tx.update(driveRoles).set({ jobTitle }).where(eq(driveRoles.roleId, roleId));
    });
    refresh(); return { ok: true };
  } catch (error) { return { error: writeError(error, roleReferenced) }; }
}

export async function updateRole(roleId: unknown, input: unknown, expected: unknown): Promise<DriveResult> { return changeRole(roleId, input, expected, false); }
export async function deleteRole(roleId: unknown, expected: unknown): Promise<DriveResult> { return changeRole(roleId, {}, expected, true); }
