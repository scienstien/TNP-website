import { isValidIsoDate } from "@/lib/calendar/dates";
import { PROCESS_TYPES, type ProcessType } from "@/lib/calendar/labels";

export const isUuid =(value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Drives, roles and their process stages are edited by any administrator acting in a department. */
export function canManageDrives(role: string | null, hasDepartment: boolean): boolean {
  return (role === "ADMIN" || role === "SUPERADMIN") && hasDepartment;
}

export const MAX_DRIVE_ROLES = 20;

/** A drive cannot be created for a cycle that has not started yet. */
export function validateDriveCycleCode(code: string, now = new Date()) {
  const match = /^(\d{4})-(\d{2})$/.exec(code);
  if (match && Number(match[1]) > now.getUTCFullYear()) {
    throw new Error(`A drive cannot be created for the future placement cycle ${code}.`);
  }
}

export function objectInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid data.");
  return input as Record<string, unknown>;
}

export function onlyKeys(values: Record<string, unknown>, keys: string[]) {
  if (Object.keys(values).some(key => !keys.includes(key))) throw new Error("Only the displayed fields can be edited. Drive company and cycle are fixed.");
}

export function nullableText(value: unknown, max: number, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error(`${label} must be text or blank.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${label} must use at most ${max} characters.`);
  return text || null;
}

const HR_KEYS = ["hrName", "hrEmail", "hrPhoneNumber"];
export interface DriveHrInput { hrName: string; hrEmail: string; hrPhoneNumber: string }

/** Every drive needs its own HR contact: name, email and phone are all required. */
export function validateDriveHr(values: Record<string, unknown>): DriveHrInput {
  const required = (key: string, max: number, label: string) => {
    const text = nullableText(values[key], max, label);
    if (text === null) throw new Error(`Enter the drive's HR ${label.toLowerCase()}.`);
    return text.replace(/\s+/gu, " ");
  };
  const hrName = required("hrName", 100, "Name");
  const hrEmail = required("hrEmail", 254, "Email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hrEmail)) throw new Error("Enter a valid HR email address.");
  const hrPhoneNumber = required("hrPhoneNumber", 30, "Phone");
  if (!/^[+\d][\d\s().-]{5,}$/.test(hrPhoneNumber)) throw new Error("Enter a valid HR phone number.");
  return { hrName, hrEmail, hrPhoneNumber };
}

export function validateDrive(input: unknown, creating: boolean) {
  const values = objectInput(input);
  onlyKeys(values, creating ? ["companyId", "cycleId", "reference", ...HR_KEYS, "roles", "stages"] : ["reference", ...HR_KEYS]);
  if (creating && (!isUuid(values.companyId) || !isUuid(values.cycleId))) throw new Error("Choose a company and an existing placement cycle.");
  return {
    companyId: values.companyId as string, cycleId: values.cycleId as string, reference: nullableText(values.reference, 120, "Reference"),
    ...validateDriveHr(values),
    roles: creating ? validateNewRoles(values.roles) : [], stages: creating ? validateDriveStages(values.stages) : [],
  };
}

export interface NewRoleInput { jobTitle: string; domain: string | null }

/** The role's field (Software, Production, …). Optional; analytics show missing ones as Not recorded. */
export const roleDomain = (value: unknown) => nullableText(value, 80, "Domain")?.replace(/\s+/gu, " ") ?? null;

/** A new drive needs at least one role, each with a job title; the domain is optional. */
export function validateNewRoles(value: unknown): NewRoleInput[] {
  if (!Array.isArray(value) || !value.length) throw new Error("Add at least one role with a job title to every drive.");
  if (value.length > MAX_DRIVE_ROLES) throw new Error(`Add at most ${MAX_DRIVE_ROLES} roles at a time.`);
  return value.map(role => {
    const values = objectInput(role);
    onlyKeys(values, ["jobTitle", "domain"]);
    const jobTitle = nullableText(values.jobTitle, 120, "Job title");
    if (jobTitle === null) throw new Error("Every role needs a job title.");
    return { jobTitle, domain: roleDomain(values.domain) };
  });
}

export interface DriveStageInput { processType: ProcessType; scheduledDate: string | null; label: string | null }

/** Process stages created with a new drive. They apply to the whole drive: every role shares them. */
export function validateDriveStages(value: unknown): DriveStageInput[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("Process stages must be a list.");
  if (value.length > 20) throw new Error("Add at most 20 process stages at a time.");
  return value.map(stage => {
    const values = objectInput(stage);
    onlyKeys(values, ["processType", "scheduledDate", "label"]);
    if (!PROCESS_TYPES.includes(values.processType as ProcessType)) throw new Error("Choose a valid process stage.");
    if (values.scheduledDate !== null && values.scheduledDate !== undefined && (typeof values.scheduledDate !== "string" || !isValidIsoDate(values.scheduledDate))) throw new Error("Choose a real date for each process stage or leave it unscheduled.");
    return { processType: values.processType as ProcessType, scheduledDate: (values.scheduledDate as string | null | undefined) ?? null, label: nullableText(values.label, 200, "Label") };
  });
}

/** Drives drafted while adding a company: the company ID comes from the new row, not the client. */
export function validateNewCompanyDrives(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("Drives must be a list.");
  if (value.length > 10) throw new Error("Add at most 10 drives at a time.");
  return value.map(drive => {
    const values = objectInput(drive);
    onlyKeys(values, ["cycleId", "reference", ...HR_KEYS, "roles", "stages"]);
    if (!isUuid(values.cycleId)) throw new Error("Choose an existing placement cycle for every drive.");
    return { cycleId: values.cycleId, reference: nullableText(values.reference, 120, "Reference"), ...validateDriveHr(values), roles: validateNewRoles(values.roles), stages: validateDriveStages(values.stages) };
  });
}

export function validateRole(input: unknown, creating: boolean) {
  const values = objectInput(input);
  onlyKeys(values, creating ? ["driveId", "jobTitle", "domain"] : ["jobTitle", "domain"]);
  if (creating && !isUuid(values.driveId)) throw new Error("Choose a drive.");
  const jobTitle = nullableText(values.jobTitle, 120, "Job title");
  if (creating && jobTitle === null) throw new Error("Every role needs a job title.");
  return { driveId: values.driveId as string, jobTitle, domain: roleDomain(values.domain) };
}

export function assertSnapshot(current: unknown, expected: unknown, label: string) {
  if (typeof expected !== "string" || JSON.stringify(current) !== expected) throw new Error(`This ${label} changed. Reopen it to load the latest values.`);
}
