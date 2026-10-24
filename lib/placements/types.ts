/** Placement data shared by the server query and the client dashboard. */

export const OFFER_TYPES = ["PPO", "FTE", "FTE+6month"] as const;
export type OfferTypeValue = (typeof OFFER_TYPES)[number];

export const REGISTRATION_STATUSES = ["REGISTERED", "UNREGISTERED"] as const;
export type RegistrationStatusValue = (typeof REGISTRATION_STATUSES)[number];
export const DEGREE_LEVELS = ["UG", "PG"] as const;
export type DegreeLevel = (typeof DEGREE_LEVELS)[number];

export interface PlacementOffer {
  company: string;
  /** drive_roles.domain of the offer's role; null when the offer has no role or the role has no domain. companies.domain is only a company description and is not used here. */
  domain: string | null;
  /** placement_offers.package_lpa in LPA; null when not recorded. */
  packageLpa: number | null;
  offerType: OfferTypeValue | null;
  offerDate: string | null;
}

/**
 * One row per explicit student-cycle participation at the requested degree level. Names, roll numbers and
 * any other student identifier are not sent to the browser. Placement status is derived from
 * registrationStatus and offer; it is not stored.
 */
export interface PlacementRecord {
  /** Lower-case department code, e.g. "mme". */
  department: string;
  programmeId: string;
  specialization: string | null;
  graduationYear: number;
  cycleId: string;
  cycleCode: string;
  /** YYYY-MM-DD, or null when the historical cycle boundary was not recorded. */
  cycleStartsOn: string | null;
  /** YYYY-MM-DD, or null when the historical cycle boundary was not recorded. */
  cycleEndsOn: string | null;
  registrationStatus: RegistrationStatusValue;
  offer: PlacementOffer | null;
}
