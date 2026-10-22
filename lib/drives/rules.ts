export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function canManageHistorical(role: string | null, hasDepartment: boolean): boolean {
  return role === "SUPERADMIN" && hasDepartment;
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

export function validateDrive(input: unknown, creating: boolean) {
  const values = objectInput(input);
  onlyKeys(values, creating ? ["companyId", "cycleId", "reference"] : ["reference"]);
  if (creating && (!isUuid(values.companyId) || !isUuid(values.cycleId))) throw new Error("Choose a company and an existing placement cycle.");
  return { companyId: values.companyId as string, cycleId: values.cycleId as string, reference: nullableText(values.reference, 120, "Reference") };
}

export function validateRole(input: unknown, creating: boolean) {
  const values = objectInput(input);
  onlyKeys(values, creating ? ["driveId", "jobTitle"] : ["jobTitle"]);
  if (creating && !isUuid(values.driveId)) throw new Error("Choose a drive.");
  return { driveId: values.driveId as string, jobTitle: nullableText(values.jobTitle, 120, "Job title") };
}

export function assertSnapshot(current: unknown, expected: unknown, label: string) {
  if (typeof expected !== "string" || JSON.stringify(current) !== expected) throw new Error(`This ${label} changed. Reopen it to load the latest values.`);
}
