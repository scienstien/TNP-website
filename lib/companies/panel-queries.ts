import "server-only";
import { db } from "@/db";
import { readDriveOptions } from "@/lib/drives/read";
import { readCalendarEvents } from "@/lib/calendar/read";
import { requireCompanyPanelScope } from "./panel-scope";
import { assertCompanyPanelSelection } from "./panel-read-guards";
import { isUuid } from "./records";

export async function getCompanyDriveOptions(companyId: string, cycleId: string) {
  await requireCompanyPanelScope();
  if (!isUuid(companyId) || !isUuid(cycleId)) throw new Error("Choose a valid company and placement cycle.");
  return db.transaction(async tx => {
    await assertCompanyPanelSelection(tx, companyId, cycleId);
    return readDriveOptions(tx, { companyId, cycleId });
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function getCompanyProcess(companyId: string, cycleId: string, driveId: string) {
  await requireCompanyPanelScope();
  if (!isUuid(companyId) || !isUuid(cycleId)) throw new Error("Choose a valid company and placement cycle.");
  if (!isUuid(driveId)) throw new Error("Choose a valid drive.");
  return db.transaction(async tx => {
    await assertCompanyPanelSelection(tx, companyId, cycleId);
    const options = await readDriveOptions(tx, { companyId, cycleId });
    if (!options.some(drive => drive.driveId === driveId)) throw new Error("This drive is no longer available for the selected company and cycle.");
    return readCalendarEvents(tx, { companyId, cycleId, driveId });
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
