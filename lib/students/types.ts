import type { OfferTypeValue } from "@/lib/placements/types";

export interface StudentOffer {
  companyName: string;
  jobRole: string | null;
  packageLpa: string | null;
  offerType: OfferTypeValue | null;
  offerDate: string | null;
}
export interface StudentRecord {
  rollNumber: number;
  name: string;
  batchYear: number;
  offer: StudentOffer | null;
}
export interface StudentData {
  students: StudentRecord[];
  companies: { name: string; domain: string | null }[];
}
export type StudentChanges = {
  name?: string;
  batchYear?: number;
  offer?: Partial<StudentOffer>;
};
export type StudentInput = StudentChanges & { rollNumber?: number };
export interface StudentResult {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}
export interface CompanyResult extends StudentResult {
  company?: StudentData["companies"][number];
}
