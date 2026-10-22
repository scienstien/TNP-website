/** Placement data shared by the server query and the client dashboard. */

export const OFFER_TYPES = ["PPO", "FTE", "FTE+6month"] as const;
export type OfferTypeValue = (typeof OFFER_TYPES)[number];

export const REGISTRATION_STATUSES = ["REGISTERED", "UNREGISTERED"] as const;
export type RegistrationStatusValue = (typeof REGISTRATION_STATUSES)[number];

export interface PlacementOffer {
  company: string;
  /** companies.domain; null when the source did not record it. */
  sector: string | null;
  /** placement_offers.package_lpa in LPA; null when not recorded. */
  packageLpa: number | null;
  offerType: OfferTypeValue | null;
  offerDate: string | null;
}

/**
 * One row per explicit undergraduate student-cycle participation. Names are not sent to the
 * dashboard. Placement status is derived from registrationStatus and offer; it is not stored.
 */
export interface PlacementRecord {
  /** Lower-case department code, e.g. "mme". */
  department: string;
  rollNumber: number;
  batchYear: number;
  cycleId: string;
  cycleCode: string;
  /** YYYY-MM-DD, or null when the historical cycle boundary was not recorded. */
  cycleStartsOn: string | null;
  /** YYYY-MM-DD, or null when the historical cycle boundary was not recorded. */
  cycleEndsOn: string | null;
  registrationStatus: RegistrationStatusValue;
  offer: PlacementOffer | null;
}
