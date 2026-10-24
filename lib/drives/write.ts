import "server-only";
import { eq } from "drizzle-orm";
import { driveEvents, driveRoles, drives } from "@/db/schema";
import { getCurrentUser, resolveDepartment } from "@/lib/auth/dal";
import type { Transaction } from "@/lib/placements/cycles";
import { canManageDrives, type DriveHrInput, type DriveStageInput, type NewRoleInput } from "./rules";

/** Drive, role and process-stage (calendar event) writes, from Companies or the calendar. */
export async function authorizeDriveWrite(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Your session has expired. Sign in again.";
  if (user.role !== "ADMIN" && user.role !== "SUPERADMIN") return "Only administrators can change drives, roles or process stages.";
  const department = await resolveDepartment(user);
  return canManageDrives(user.role, department !== null) ? null : "Choose a department first. All departments is read-only.";
}

/**
 * Inserts one drive, its roles and its whole-drive process stages (shared by every role,
 * shown in the process calendar). The caller authorizes and has checked company and cycle.
 */
export async function insertDriveWithRoles(tx: Transaction, data: { companyId: string; cycleId: string; reference: string | null; roles: NewRoleInput[]; stages: DriveStageInput[] } & DriveHrInput) {
  if (!data.roles.length) throw new Error("Add at least one role with a job title to every drive.");
  const [drive] = await tx.insert(drives).values({ companyId: data.companyId, cycleId: data.cycleId, reference: data.reference, hrName: data.hrName, hrEmail: data.hrEmail, hrPhoneNumber: data.hrPhoneNumber }).returning({ driveId: drives.driveId });
  await tx.insert(driveRoles).values(data.roles.map(role => ({ driveId: drive.driveId, ...role })));
  if (data.stages.length) await tx.insert(driveEvents).values(data.stages.map(stage => ({ driveId: drive.driveId, scope: "WHOLE_DRIVE" as const, ...stage })));
  return drive.driveId;
}

/** All drive/role/event writers take this lock first, before locking child rows. */
export async function lockDrive(tx: Transaction, driveId: string) {
  const [drive] = await tx.select().from(drives).where(eq(drives.driveId, driveId)).for("update");
  if (!drive) throw new Error("This drive no longer exists.");
  return drive;
}

export function writeError(error: unknown, foreignKeyMessage: string): string {
  const code = (error as { code?: string; cause?: { code?: string } })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
  if (code === "23503") return foreignKeyMessage;
  // Plain Error is used for validation/stale conflicts; database internals stay on the server.
  return error instanceof Error && error.constructor === Error && !code && !("query" in error) ? error.message : "Unable to save. Reload and try again.";
}
