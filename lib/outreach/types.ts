export type OutreachPvrStatus = "yes" | "no";

export interface OutreachRecord {
  id: string;
  companyName: string;
  hrName: string | null;
  phoneNumber: string | null;
  email: string | null;
  pvrStatus: OutreachPvrStatus;
  remarks: string | null;
  updatedAt: string;
}

export interface OutreachResult {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<
    Record<
      | "companyName"
      | "hrName"
      | "phoneNumber"
      | "email"
      | "pvrStatus"
      | "remarks"
      | "form",
      string
    >
  >;
}
