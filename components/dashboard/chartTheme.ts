/**
 * Chart colours and axis styling for the dark navy theme. The offer-type palette was
 * validated on the panel surface (#131c2b): lightness band, chroma, CVD separation,
 * normal-vision distinctness and 3:1 contrast all pass.
 */
import type { OfferTypeValue } from "@/lib/placements/types";
import { NOT_RECORDED } from "@/lib/placements/analytics";

export const ACCENT = "#3a72e6";
export const SURFACE = "#131c2b";
export const GRID = "rgba(110, 160, 255, 0.12)";
export const AXIS_TEXT = "#8f9bb0";
export const LABEL_TEXT = "#dbe7fc";

export const OFFER_TYPE_COLORS: Record<
  OfferTypeValue | typeof NOT_RECORDED,
  string
> = {
  FTE: "#3a72e6",
  "FTE+6month": "#22a08c",
  PPO: "#9b6fe0",
  [NOT_RECORDED]: "#4a5d7e",
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
