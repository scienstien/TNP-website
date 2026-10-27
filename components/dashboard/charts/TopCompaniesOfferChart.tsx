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
import type { CompanyOfferRow } from "@/lib/placements/analytics";
import ChartCard from "../ChartCard";
import ChartTooltip from "../ChartTooltip";
import { ACCENT, AXIS_TEXT, GRID, LABEL_TEXT, axisTick } from "../chartTheme";
import { formatLpa, plural } from "../format";

interface Props {
  data: CompanyOfferRow[];
  onCompanySelect: (company: string) => void;
}

/** Horizontal bars: the top companies by number of students offered placements. */
export default function TopCompaniesOfferChart({
  data,
  onCompanySelect,
}: Props) {
  const height = Math.max(200, data.length * 34 + 48);

  return (
    <ChartCard
      title="Top companies by offers"
      subtitle="Top 10 · select a bar to filter"
      isEmpty={data.length === 0}
      table={{
        caption: "Top companies by number of students offered placements",
        columns: ["Company", "Students", "Average CTC"],
        rows: data.map((row) => [
          row.company,
          row.offers,
          formatLpa(row.average),
        ]),
      }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 40, bottom: 22, left: 4 }}
          barCategoryGap={8}
        >
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            label={{
              value: "Number of students",
              position: "insideBottom",
              offset: -14,
              fill: AXIS_TEXT,
              fontSize: 11,
            }}
          />
          <YAxis
            type="category"
            dataKey="company"
            width={160}
            interval={0}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(110, 160, 255, 0.06)" }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as CompanyOfferRow | undefined;
              if (!active || !row) return null;
              return (
                <ChartTooltip
                  title={row.company}
                  value={plural(row.offers, "student")}
                  lines={[
                    row.average === null
                      ? "No CTC recorded"
                      : `Avg ${formatLpa(row.average)} · Min ${row.min} · Max ${row.max}`,
                    `PPO ${row.byType.PPO} · FTE ${row.byType.FTE} · FTE+6M ${row.byType["FTE+6month"]}`,
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="offers"
            fill={ACCENT}
            barSize={16}
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(entry: { payload?: CompanyOfferRow }) => {
              if (entry.payload) onCompanySelect(entry.payload.company);
            }}
          >
            <LabelList
              dataKey="offers"
              position="right"
              fill={LABEL_TEXT}
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
