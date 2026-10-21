"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CtcBucket } from "@/lib/placements/analytics";
import ChartCard from "../ChartCard";
import ChartTooltip from "../ChartTooltip";
import { ACCENT, AXIS_TEXT, GRID, LABEL_TEXT, axisTick } from "../chartTheme";
import { formatLpa, formatPct, plural } from "../format";

interface Props {
  data: CtcBucket[];
  /** Offers in scope without a recorded package; excluded from the histogram. */
  excluded: number;
  onRangeSelect: (bucket: CtcBucket) => void;
}

/** Histogram of offers across fixed CTC ranges (LPA), identical for every batch. */
export default function CTCDistributionChart({
  data,
  excluded,
  onRangeSelect,
}: Props) {
  const offers = data.reduce((sum, bucket) => sum + bucket.offers, 0);

  return (
    <ChartCard
      title="CTC distribution"
      subtitle="Offers across CTC ranges (LPA) · select a bar to filter"
      isEmpty={offers === 0}
      fill
      emptyMessage={
        excluded > 0
          ? `None of the ${plural(excluded, "matching offer")} has a recorded CTC.`
          : undefined
      }
      footnote={
        excluded > 0
          ? `${plural(excluded, "offer")} without a recorded CTC ${
              excluded === 1 ? "is" : "are"
            } excluded.`
          : "Every matching offer has a recorded CTC."
      }
      table={{
        caption: "Offers by CTC range",
        columns: ["CTC range (LPA)", "Offers", "Share", "Average CTC"],
        rows: data.map((bucket) => [
          bucket.label,
          bucket.offers,
          formatPct(bucket.share),
          formatLpa(bucket.average),
        ]),
      }}
    >
      <ResponsiveContainer width="100%" height="100%" minHeight={260}>
        <BarChart
          data={data}
          margin={{ top: 22, right: 8, bottom: 22, left: 0 }}
        >
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            label={{
              value: "CTC range (LPA)",
              position: "insideBottom",
              offset: -14,
              fill: AXIS_TEXT,
              fontSize: 11,
            }}
          />
          <YAxis
            allowDecimals={false}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "rgba(110, 160, 255, 0.06)" }}
            content={({ active, payload }) => {
              const bucket = payload?.[0]?.payload as CtcBucket | undefined;
              if (!active || !bucket) return null;
              return (
                <ChartTooltip
                  title={`CTC ${bucket.label} LPA`}
                  value={`${plural(bucket.offers, "offer")} (${formatPct(bucket.share)})`}
                  lines={[`Average ${formatLpa(bucket.average)}`]}
                />
              );
            }}
          />
          <Bar
            dataKey="offers"
            fill={ACCENT}
            barSize={24}
            radius={[4, 4, 0, 0]}
            cursor="pointer"
            onClick={(entry: { payload?: CtcBucket }) => {
              if (entry.payload) onRangeSelect(entry.payload);
            }}
          >
            <LabelList
              dataKey="offers"
              position="top"
              fill={LABEL_TEXT}
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
