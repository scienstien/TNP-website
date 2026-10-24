import type { OfferTypeValue, RegistrationStatusValue } from "@/lib/placements/types";
import type { DriveOption } from "@/lib/drives/types";

export type StudentDegreeLevel = "UG" | "PG";

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
  driveId: string | null;
  driveReference: string | null;
  roleId: string | null;
  jobRole: string | null;
  roleDomain: string | null;
  packageLpa: string | null;
  offerType: OfferTypeValue | null;
  offerDate: string | null;
}
/** One enrollment in the selected degree-level view, identified by its roll number. */
export interface StudentRecord {
  studentId: string;
  enrollmentId: string;
  rollNumber: number;
  name: string;
  genderCode: string | null;
  reservationCategoryCode: string | null;
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
/** The department's cohorts for the selected degree level and their associated placement cycles. */
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
export interface ControlledOption { code: string; label: string }
export interface StudentData {
  /** Explicit route/write context. Never inferred from a cohort or graduation year. */
  level: StudentDegreeLevel;
  students: StudentRecord[];
  /** The department's programmes for `level` only. */
  programmes: ProgrammeOption[];
  /** Every existing placement cycle (none is created or inferred here), newest code first. */
  cycles: CycleOption[];
  cohorts: CohortOption[];
  companies: CompanyOption[];
  /** Existing institute-wide drives and roles; writes select identities, never create them. */
  drives: DriveOption[];
  genderTypes: ControlledOption[];
  reservationCategories: ControlledOption[];
}
/** Offer edits. cycleId names the student-cycle a new offer belongs to. */
export type OfferChanges = {
  cycleId?: string;
  companyId?: string;
  driveId?: string | null;
  roleId?: string | null;
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
  genderCode?: string | null;
  reservationCategoryCode?: string | null;
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
