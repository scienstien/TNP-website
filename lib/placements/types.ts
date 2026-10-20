/** Placement data shared by the server query and the client dashboard. */

export const OFFER_TYPES = ["PPO", "FTE", "FTE+6month"] as const;
export type OfferTypeValue = (typeof OFFER_TYPES)[number];

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
 * One row per recorded (eligible) student. A student has zero or one offer, so placement
 * status is simply whether `offer` is present. Names are not sent to the dashboard.
 */
export interface PlacementRecord {
  rollNumber: number;
  batchYear: number;
  offer: PlacementOffer | null;
}
