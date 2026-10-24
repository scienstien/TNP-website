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
import type { DomainRow } from "@/lib/placements/analytics";
import ChartCard from "../ChartCard";
import ChartTooltip from "../ChartTooltip";
import { ACCENT, AXIS_TEXT, GRID, LABEL_TEXT, axisTick } from "../chartTheme";
import { formatPct, plural } from "../format";

interface Props {
  data: DomainRow[];
  /** Students in scope without any offer; they belong to no domain. */
  unplaced: number;
  onDomainSelect: (domain: string) => void;
}

/**
 * Placed students by the domain of their offered role (drive_roles.domain), e.g. Software or
 * Production. Offers without a role or a recorded domain appear as "Not recorded".
 * companies.domain is only a company description and is never used here.
 */
export default function DomainPlacementChart({
  data,
  unplaced,
  onDomainSelect,
}: Props) {
  const height = Math.max(200, data.length * 32 + 48);
  const rows = data.map((row) => ({
    ...row,
    label: `${row.placed} · ${row.share.toFixed(0)}%`,
  }));

  return (
    <ChartCard
      title="Domain-wise placements"
      subtitle="Placed students by the domain of their offered role · select a bar to filter"
      isEmpty={data.length === 0}
      footnote={`${plural(unplaced, "student")} without an offer ${
        unplaced === 1 ? "is" : "are"
      } not attributed to any domain.`}
      table={{
        caption: "Placed students by role domain",
        columns: ["Domain", "Placed students", "Share of placed"],
        rows: data.map((row) => [row.domain, row.placed, formatPct(row.share)]),
      }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 64, bottom: 22, left: 4 }}
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
              value: "Placed students",
              position: "insideBottom",
              offset: -14,
              fill: AXIS_TEXT,
              fontSize: 11,
            }}
          />
          <YAxis
            type="category"
            dataKey="domain"
            width={140}
            interval={0}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(110, 160, 255, 0.06)" }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as DomainRow | undefined;
              if (!active || !row) return null;
              return (
                <ChartTooltip
                  title={row.domain}
                  value={plural(row.placed, "placed student")}
                  lines={[`${formatPct(row.share)} of placed students`]}
                />
              );
            }}
          />
          <Bar
            dataKey="placed"
            fill={ACCENT}
            barSize={16}
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(entry: { payload?: DomainRow }) => {
              if (entry.payload) onDomainSelect(entry.payload.domain);
            }}
          >
            <LabelList
              dataKey="label"
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
