export type PvrStatus = "yes" | "no" | "unknown";

export interface CompanyRecord {
  name: string;
  domain: string | null;
  hrName: string | null;
  email: string | null;
  phoneNumber: string | null;
  pvrStatus: PvrStatus;
  visitDate: string | null;
  /** Derived from placement_offers; never manually stored on a company. */
  offerCount: number;
}

export interface CompanyResult {
  ok?: boolean;
  company?: Omit<CompanyRecord, "offerCount">;
  error?: string;
  fieldErrors?: Partial<Record<"name" | "domain" | "hrName" | "email" | "phoneNumber" | "pvrStatus" | "visitDate" | "form", string>>;
}
