export interface DriveRoleOption {
  roleId: string;
  jobTitle: string | null;
  /** The role's field (Software, Production, …); null when not recorded. */
  domain: string | null;
}
export interface DriveOption {
  driveId: string;
  companyId: string;
  companyName: string;
  cycleId: string;
  cycleCode: string;
  reference: string | null;
  /** The drive's HR contact; null only for drives recorded before it was required. */
  hrName: string | null;
  hrEmail: string | null;
  hrPhoneNumber: string | null;
  roles: DriveRoleOption[];
}
export interface DriveOptionFilter {
  companyId?: string;
  cycleId?: string;
}
export interface DriveResult { ok?: true; error?: string }
