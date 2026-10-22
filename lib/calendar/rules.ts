import { isValidIsoDate, toIsoDate } from "./dates";
import { PROCESS_TYPES, type ProcessType } from "./labels";
import { isUuid, nullableText, objectInput, onlyKeys } from "@/lib/drives/rules";
import type { EventInput, CalendarWindow } from "./types";

export function validateEvent(input: unknown): EventInput {
  const values = objectInput(input);
  onlyKeys(values, ["driveId", "processType", "scheduledDate", "scope", "label", "roleIds"]);
  if (!isUuid(values.driveId)) throw new Error("Choose a drive by ID.");
  if (!PROCESS_TYPES.includes(values.processType as ProcessType)) throw new Error("Choose a valid process stage.");
  if (values.scheduledDate !== null && (typeof values.scheduledDate !== "string" || !isValidIsoDate(values.scheduledDate))) throw new Error("Choose a real ISO date or leave it unscheduled.");
  if (values.scope !== "WHOLE_DRIVE" && values.scope !== "SELECTED_ROLES") throw new Error("Choose an event scope.");
  if (!Array.isArray(values.roleIds) || values.roleIds.some(id => !isUuid(id))) throw new Error("Choose roles by ID.");
  const roleIds = values.roleIds as string[];
  if (new Set(roleIds.map(id => id.toLowerCase())).size !== roleIds.length) throw new Error("Choose each role only once.");
  if (values.scope === "WHOLE_DRIVE" && roleIds.length !== 0) throw new Error("Whole-drive events cannot have selected roles.");
  if (values.scope === "SELECTED_ROLES" && roleIds.length === 0) throw new Error("Select at least one role.");
  return { driveId: values.driveId.toLowerCase(), processType: values.processType as ProcessType, scheduledDate: values.scheduledDate as string | null, scope: values.scope, label: nullableText(values.label, 200, "Label"), roleIds: roleIds.map(id => id.toLowerCase()) };
}

export function assertRoleMembership(roleIds: string[], roles: { roleId: string; driveId: string }[], driveId: string) {
  if (roleIds.length !== roles.length || roles.some(role => role.driveId.toLowerCase() !== driveId.toLowerCase() || !roleIds.some(id => id.toLowerCase() === role.roleId.toLowerCase()))) throw new Error("Every selected role must belong to this drive.");
}

export function monthWindow(month: string, fallbackDate: string): CalendarWindow {
  const start = /^\d{4}-\d{2}$/.test(month) && isValidIsoDate(`${month}-01`) ? `${month}-01` : `${fallbackDate.slice(0, 7)}-01`;
  const [year, number] = start.split("-").map(Number);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { startsOn: start, endsOn: toIsoDate(year, number - 1, days) };
}
