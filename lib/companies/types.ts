export type PvrStatus = "yes" | "no" | "unknown";

export interface CompanyRecord {
  companyId: string;
  name: string;
  domain: string | null;
  hrName: string | null;
  email: string | null;
  phoneNumber: string | null;
  remarks: string | null;
  pvrStatus: PvrStatus;
  visitDate: string | null;
}

/** A directory row: the company plus its final offers in the selected cycle (all cycles when none). */
export interface CompanyListRecord extends CompanyRecord {
  offerCount: number;
  /** Median recorded package (LPA) across all roles' final offers; null when none is recorded. */
  medianLpa: number | null;
  /** medianLpa × offerCount: the sort key for "volume"; null when there is no recorded package. */
  volume: number | null;
}

export interface CompanyResult {
  ok?: boolean;
  company?: CompanyRecord;
  error?: string;
  fieldErrors?: Partial<Record<"name" | "domain" | "hrName" | "email" | "phoneNumber" | "remarks" | "pvrStatus" | "visitDate" | "form", string>>;
}
