import "server-only";
import { eq } from "drizzle-orm";
import { drives } from "@/db/schema";
import { getCurrentUser, resolveDepartment } from "@/lib/auth/dal";
import type { Transaction } from "@/lib/placements/cycles";
import { canManageHistorical } from "./rules";

export async function authorizeHistoricalWrite(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Your session has expired. Sign in again.";
  if (user.role !== "SUPERADMIN") return "Only SUPERADMIN can change drives, roles or events.";
  const department = await resolveDepartment(user);
  return canManageHistorical(user.role, department !== null) ? null : "Choose a department first. All departments is read-only.";
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
