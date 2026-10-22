export interface DriveRoleOption {
  roleId: string;
  jobTitle: string | null;
}
export interface DriveOption {
  driveId: string;
  companyId: string;
  companyName: string;
  cycleId: string;
  cycleCode: string;
  reference: string | null;
  roles: DriveRoleOption[];
}
export interface DriveOptionFilter {
  companyId?: string;
  cycleId?: string;
}
export interface DriveResult { ok?: true; error?: string }
