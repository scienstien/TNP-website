import type { OfferTypeValue, RegistrationStatusValue } from "@/lib/placements/types";

/** One explicit placement-cycle participation (student_cycles row) of the enrollment. */
export interface StudentParticipation {
  cycleId: string;
  cycleCode: string;
  registrationStatus: RegistrationStatusValue;
}
/** The enrollment's one final reported offer and the student-cycle it belongs to. */
export interface StudentOffer {
  offerId: string;
  cycleId: string;
  cycleCode: string;
  companyId: string;
  companyName: string;
  jobRole: string | null;
  packageLpa: string | null;
  offerType: OfferTypeValue | null;
  offerDate: string | null;
}
/** One undergraduate enrollment, identified by its roll number, with stable IDs for every link. */
export interface StudentRecord {
  studentId: string;
  enrollmentId: string;
  rollNumber: number;
  name: string;
  programmeId: string;
  /** Degree code, plus the specialization when there is one, e.g. "B.Tech". */
  programmeLabel: string;
  cohortId: string;
  /** The cohort's graduation year. */
  batchYear: number;
  /** Entered by an administrator; null when unknown. Never derived from the graduation year. */
  admissionYear: number | null;
  /** Ordered by cycle code, then cycle ID. */
  participations: StudentParticipation[];
  offer: StudentOffer | null;
}
export interface ProgrammeOption {
  programmeId: string;
  label: string;
}
export interface CycleOption {
  cycleId: string;
  code: string;
}
/** The department's undergraduate cohorts and the placement cycles each is associated with. */
export interface CohortOption {
  cohortId: string;
  programmeId: string;
  graduationYear: number;
  cycleIds: string[];
}
export interface CompanyOption {
  companyId: string;
  name: string;
  domain: string | null;
}
export interface StudentData {
  students: StudentRecord[];
  /** The department's undergraduate programmes. */
  programmes: ProgrammeOption[];
  /** Every existing placement cycle (none is created or inferred here), newest code first. */
  cycles: CycleOption[];
  cohorts: CohortOption[];
  companies: CompanyOption[];
}
/** Offer edits. cycleId names the student-cycle a new offer belongs to. */
export type OfferChanges = {
  cycleId?: string;
  companyId?: string;
  jobRole?: string | null;
  packageLpa?: string | null;
  offerType?: OfferTypeValue | null;
  offerDate?: string | null;
};
/** An explicit registration for a placement cycle; the status is always chosen, never defaulted. */
export interface ParticipationInput {
  cycleId: string;
  registrationStatus: RegistrationStatusValue;
}
export type StudentChanges = {
  name?: string;
  admissionYear?: number | null;
  /** Cohort identity: accepted only when unchanged on an existing student (moves are rejected). */
  programmeId?: string;
  batchYear?: number;
  offer?: OfferChanges;
};
export type StudentInput = StudentChanges & { rollNumber?: number; participation?: ParticipationInput };
export interface StudentResult {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}
export interface CompanyResult extends StudentResult {
  company?: CompanyOption;
}
