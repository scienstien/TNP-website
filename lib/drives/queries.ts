import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { readDriveOptions } from "./read";
import { isUuid } from "./rules";
import type { DriveOption, DriveOptionFilter } from "./types";

export async function getDriveOptions(filter: DriveOptionFilter): Promise<DriveOption[]> {
  await requireRole("ADMIN");
  if (!filter || typeof filter !== "object" || (filter.companyId !== undefined && !isUuid(filter.companyId)) || (filter.cycleId !== undefined && !isUuid(filter.cycleId))) return [];
  return readDriveOptions(db, filter);
}

export async function getDriveCompanies(): Promise<{ companyId: string; name: string }[]> {
  await requireRole("ADMIN");
  return db.select({ companyId: companies.companyId, name: companies.name }).from(companies).orderBy(asc(companies.name));
}
