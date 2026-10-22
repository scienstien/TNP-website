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

export interface CompanyResult {
  ok?: boolean;
  company?: CompanyRecord;
  error?: string;
  fieldErrors?: Partial<Record<"name" | "domain" | "hrName" | "email" | "phoneNumber" | "remarks" | "pvrStatus" | "visitDate" | "form", string>>;
}
