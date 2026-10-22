import type { ProcessType } from "./labels";
import type { DriveRoleOption } from "@/lib/drives/types";

export interface CalendarWindow { startsOn: string; endsOn: string }
export interface CalendarEvent {
  eventId: string;
  driveId: string;
  companyId: string;
  companyName: string;
  cycleId: string;
  cycleCode: string;
  driveReference: string | null;
  processType: ProcessType;
  scheduledDate: string | null;
  scope: "WHOLE_DRIVE" | "SELECTED_ROLES";
  label: string | null;
  roles: DriveRoleOption[];
}
export interface EventInput {
  driveId: string;
  processType: ProcessType;
  scheduledDate: string | null;
  scope: "WHOLE_DRIVE" | "SELECTED_ROLES";
  label: string | null;
  roleIds: string[];
}
export interface EventResult { ok?: true; error?: string }
