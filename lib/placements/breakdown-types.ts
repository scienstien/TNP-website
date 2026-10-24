/** Shared by the server query and the client breakdown card. */

export const BREAKDOWN_DIMENSIONS = ["department", "gender", "reservationCategory"] as const;
export type BreakdownDimension = (typeof BREAKDOWN_DIMENSIONS)[number];

export const BREAKDOWN_LABELS: Record<BreakdownDimension, string> = {
  department: "Department",
  gender: "Gender",
  reservationCategory: "Category",
};

/** The gender view lists only these groups; every other group is reported in a footnote. */
export const LISTED_GENDER_KEYS = ["gender:code:F", "gender:code:M"];

export interface BreakdownRow {
  key: string;
  label: string;
  /** REGISTERED student-cycle participations in this group. */
  registered: number;
  /** Registered participations with a final offer in the same cycle. */
  placed: number;
}

export interface PlacementBreakdown {
  rows: BreakdownRow[];
  /**
   * Everyone placed in the same cycle selection across every department. It is not limited
   * to the signed-in user's department, so a department's share of the institute can be shown.
   */
  institutePlaced: number;
}

/** Placed ÷ registered × 100; an empty registered group is undefined (null), not 0%. */
export function placementRate(placed: number, registered: number): number | null {
  return registered > 0 ? (placed / registered) * 100 : null;
}
