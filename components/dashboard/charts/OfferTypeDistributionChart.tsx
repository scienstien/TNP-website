"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { NOT_RECORDED, type OfferTypeSlice } from "@/lib/placements/analytics";
import type { OfferTypeValue } from "@/lib/placements/types";
import ChartCard from "../ChartCard";
import ChartTooltip from "../ChartTooltip";
import { OFFER_TYPE_COLORS, OFFER_TYPE_LABELS, SURFACE } from "../chartTheme";
import { formatPct, plural } from "../format";

interface Props {
  data: OfferTypeSlice[];
  selectedType: OfferTypeValue | null;
  onOfferTypeSelect: (type: OfferTypeValue) => void;
}

/** Donut of offers (not students) by offer type, with the total in the centre. */
export default function OfferTypeDistributionChart({
  data,
  selectedType,
  onOfferTypeSelect,
}: Props) {
  const total = data.reduce((sum, slice) => sum + slice.offers, 0);
  const select = (slice: OfferTypeSlice) => {
    if (slice.type !== NOT_RECORDED) onOfferTypeSelect(slice.type);
  };

  return (
    <ChartCard
      title="Offer type distribution"
      subtitle="Share of offers by type · select a segment to filter"
      isEmpty={total === 0}
      table={{
        caption: "Offers by offer type",
        columns: ["Offer type", "Offers", "Share"],
        rows: data.map((slice) => [
          OFFER_TYPE_LABELS[slice.type],
          slice.offers,
          formatPct(slice.share),
        ]),
      }}
    >
      <div className="mme-donut-layout">
        <div className="mme-donut">
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={data}
                dataKey="offers"
                nameKey="type"
                innerRadius="62%"
                outerRadius="94%"
                stroke={SURFACE}
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(_, index) => select(data[index])}
              >
                {data.map((slice) => (
                  <Cell
                    key={slice.type}
                    fill={OFFER_TYPE_COLORS[slice.type]}
                    fillOpacity={
                      selectedType && selectedType !== slice.type ? 0.35 : 1
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  const slice = payload?.[0]?.payload as
                    | OfferTypeSlice
                    | undefined;
                  if (!active || !slice) return null;
                  return (
                    <ChartTooltip
                      title={OFFER_TYPE_LABELS[slice.type]}
                      value={plural(slice.offers, "offer")}
                      lines={[`${formatPct(slice.share)} of ${total} offers`]}
                    />
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mme-donut-center">
            <b>{total}</b>
            <span>total offers</span>
          </div>
        </div>

        <ul className="mme-legend">
          {data.map((slice) => {
            const content = (
              <>
                <i style={{ background: OFFER_TYPE_COLORS[slice.type] }} />
                <span>{OFFER_TYPE_LABELS[slice.type]}</span>
                <b>
                  {slice.offers} <small>({formatPct(slice.share)})</small>
                </b>
              </>
            );
            return (
              <li key={slice.type}>
                {slice.type === NOT_RECORDED ? (
                  <div className="mme-legend-item">{content}</div>
                ) : (
                  <button
                    type="button"
                    className="mme-legend-item"
                    aria-pressed={selectedType === slice.type}
                    onClick={() => select(slice)}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </ChartCard>
  );
}
