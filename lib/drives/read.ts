import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { companies, driveRoles, drives, placementCycles } from "@/db/schema";
import type { Database, Transaction } from "@/lib/placements/cycles";
import type { DriveOption, DriveOptionFilter } from "./types";

/** No auth here: callers authorize first. Two queries, with roles grouped by drive ID. */
export async function readDriveOptions(connection: Database | Transaction, filter: DriveOptionFilter): Promise<DriveOption[]> {
  const rows = await connection.select({ driveId: drives.driveId, companyId: drives.companyId, companyName: companies.name, cycleId: drives.cycleId, cycleCode: placementCycles.code, reference: drives.reference, hrName: drives.hrName, hrEmail: drives.hrEmail, hrPhoneNumber: drives.hrPhoneNumber })
    .from(drives).innerJoin(companies, eq(companies.companyId, drives.companyId)).innerJoin(placementCycles, eq(placementCycles.cycleId, drives.cycleId))
    .where(and(filter.companyId ? eq(drives.companyId, filter.companyId) : undefined, filter.cycleId ? eq(drives.cycleId, filter.cycleId) : undefined))
    .orderBy(desc(placementCycles.code), asc(companies.name), sql`${drives.reference} asc nulls last`, asc(drives.driveId));
  if (!rows.length) return [];
  const roles = await connection.select().from(driveRoles).where(inArray(driveRoles.driveId, rows.map(row => row.driveId)))
    .orderBy(sql`${driveRoles.jobTitle} asc nulls last`, asc(driveRoles.roleId));
  const byDrive = new Map<string, DriveOption["roles"]>();
  for (const role of roles) {
    const group = byDrive.get(role.driveId) ?? [];
    group.push({ roleId: role.roleId, jobTitle: role.jobTitle, domain: role.domain });
    byDrive.set(role.driveId, group);
  }
  return rows.map(row => ({ ...row, roles: byDrive.get(row.driveId) ?? [] }));
}
