/**
 * Chart colours and axis styling for the portal's light palette.
 */
import type { OfferTypeValue } from "@/lib/placements/types";
import { NOT_RECORDED } from "@/lib/placements/analytics";

export const ACCENT = "#579bc9";
export const SURFACE = "#ffebcc";
export const GRID = "rgba(36, 55, 70, 0.2)";
export const AXIS_TEXT = "#526675";
export const LABEL_TEXT = "#243746";

export const OFFER_TYPE_COLORS: Record<
  OfferTypeValue | typeof NOT_RECORDED,
  string
> = {
  FTE: "#579bc9",
  "FTE+6month": "#8cc0eb",
  PPO: "#94aec1",
  [NOT_RECORDED]: "#b3b9ab",
};

export const OFFER_TYPE_LABELS: Record<
  OfferTypeValue | typeof NOT_RECORDED,
  string
> = {
  FTE: "FTE",
  "FTE+6month": "FTE + 6 months",
  PPO: "PPO",
  [NOT_RECORDED]: "Type not recorded",
};

export const axisTick = { fill: AXIS_TEXT, fontSize: 11 };
