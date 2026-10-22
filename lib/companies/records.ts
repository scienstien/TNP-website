import { pvrStatusFromDatabase } from "./validation";
import type { CompanyRecord } from "./types";

export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function companyRecord(row: Omit<CompanyRecord, "pvrStatus" | "visitDate"> & { pvrStatus: boolean | null }, visitDate: string | null = null): CompanyRecord {
  return { companyId: row.companyId, name: row.name, domain: row.domain, hrName: row.hrName, email: row.email, phoneNumber: row.phoneNumber, remarks: row.remarks, pvrStatus: pvrStatusFromDatabase(row.pvrStatus), visitDate };
}

/** The PPT projection is not a company field and is never read/overwritten by a contact save. */
export function companySnapshotMatches(current: CompanyRecord, expected: unknown): boolean {
  if (typeof expected !== "string") return false;
  try {
    const previous = JSON.parse(expected);
    return previous !== null && typeof previous === "object" &&
      (Object.keys(current) as (keyof CompanyRecord)[]).filter(key => key !== "visitDate").every(key => previous[key] === current[key]);
  } catch { return false; }
}
