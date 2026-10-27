"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildTimeSeries,
  MOVING_AVERAGE_DAYS,
  MOVING_AVERAGE_WEEKS,
  offerDates,
  type TimeKpi,
  type TimeSeries,
  type TimeView,
} from "@/lib/placements/time-series";
import type { PlacementRecord } from "@/lib/placements/types";
import type { DegreeLevel } from "@/lib/placements/types";
import ChartTooltip from "./ChartTooltip";
import { ACCENT, AXIS_TEXT, GRID, LABEL_TEXT, axisTick } from "./chartTheme";
import { plural } from "./format";

/** One accent, one secondary (last year) and gray for everything muted. */
const SECONDARY = "#8cc0eb";
const MUTED = "#94aec1";
/** Daily and weekly views distinguish observations from their moving average. */
const RAW_LINE = "#579bc9";
const AVERAGE_LINE = "#243746";
const CHART_HEIGHT = 320;

interface ViewOption { id: TimeView; label: string; titles: { total: string; change: string; peak: string } }
const VIEWS: ViewOption[] = [
  { id: "year", label: "Year", titles: { total: "Placed this year", change: "Change vs previous year", peak: "Peak year" } },
  { id: "month", label: "Month", titles: { total: "Placed this month", change: "Change vs previous month", peak: "Peak month" } },
  { id: "week", label: "Week", titles: { total: "Placed this week", change: "Change vs previous week", peak: "Peak week" } },
  { id: "day", label: "Day", titles: { total: "Placed today", change: "Change vs yesterday", peak: "Peak day (last 30)" } },
];

const subscribeNothing = () => () => {};
/** False on the server and the first client render, so the chart area shows a skeleton until it can measure itself. */
const useHydrated = () => useSyncExternalStore(subscribeNothing, () => true, () => false);

type Aggregation = { series: TimeSeries; undated: number; future: number } | { error: string };

interface Props {
  records: PlacementRecord[];
  /** Today at the institute (YYYY-MM-DD), from the server so every render agrees on "current". */
  today: string;
  /** The chosen department's name, or null when every department is shown. */
  departmentName: string | null;
  degreeLevel?: DegreeLevel;
}

/**
 * "Students placed over time": final offers by offer date, switchable between Year, Month and
 * Week. Everything is aggregated once per data change, so the toggle only picks a series.
 */
export default function StudentsOverTime({ records, today, departmentName, degreeLevel = "UG" }: Props) {
  const [view, setView] = useState<TimeView>("year");
  const [attempt, setAttempt] = useState(0);
  const hydrated = useHydrated();
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const headingId = useId();

  const aggregation = useMemo<Aggregation>(() => {
    void attempt; // "Try again" recomputes after a failure.
    try {
      const { dates, undated, future } = offerDates(records, today);
      return { series: buildTimeSeries(dates, today), undated, future };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "The data could not be aggregated." };
    }
  }, [records, today, attempt]);

  const scope = departmentName ?? "all departments";
  const move = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + VIEWS.length) % VIEWS.length;
    setView(VIEWS[next].id);
    radios.current[next]?.focus();
  };

  return (
    <section className="panel mme-card mme-time" aria-labelledby={headingId}>
      <header className="mme-card-head">
        <div>
          <h2 id={headingId}>{degreeLevel === "PG" ? "PG students placed over time" : "Students placed over time"}</h2>
          <p>Final offers by offer date · {degreeLevel === "PG" ? "PG · " : ""}{scope}</p>
        </div>
        <div className="mme-seg" role="radiogroup" aria-label="Group students by">
          {VIEWS.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => { radios.current[index] = node; }}
              type="button"
              role="radio"
              aria-checked={view === item.id}
              tabIndex={view === item.id ? 0 : -1}
              onClick={() => setView(item.id)}
              onKeyDown={(event) => move(event, index)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {"error" in aggregation ? (
        <div className="mme-empty mme-time-state" role="alert">
          <p>Students over time could not be loaded. {aggregation.error}</p>
          <button type="button" className="mme-time-retry" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
        </div>
      ) : !hydrated ? (
        <TimeSkeleton />
      ) : aggregation.series.counted === 0 ? (
        <div className="mme-empty mme-time-state" role="status">
          {departmentName ? "No student data for this department yet." : "No student data yet."}
        </div>
      ) : (
        <TimeBody view={view} series={aggregation.series} undated={aggregation.undated} future={aggregation.future} />
      )}
    </section>
  );
}

function TimeSkeleton() {
  return (
    <div className="mme-time-skeleton" role="status" aria-busy="true" aria-label="Loading students over time">
      <div className="mme-time-skeleton-kpis">{[0, 1, 2].map((item) => <span key={item} />)}</div>
      <div className="mme-time-skeleton-chart" />
    </div>
  );
}

function TimeBody({ view, series, undated, future }: { view: TimeView; series: TimeSeries; undated: number; future: number }) {
  const kpi = series.kpis[view];
  const titles = VIEWS.find((item) => item.id === view)!.titles;
  return (
    <>
      <KpiRow kpi={kpi} titles={titles} />
      <Legend view={view} series={series} />
      <TimeChart view={view} series={series} />
      {(undated > 0 || future > 0) && (
        <p className="mme-footnote">
          Not shown: {[undated > 0 && `${plural(undated, "offer")} with no offer date`, future > 0 && `${plural(future, "offer")} dated in the future`].filter(Boolean).join(" and ")}.
        </p>
      )}
    </>
  );
}

function KpiRow({ kpi, titles }: { kpi: TimeKpi; titles: ViewOption["titles"] }) {
  const change = kpi.changePct;
  const direction = change === null || change === 0 ? "flat" : change > 0 ? "up" : "down";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "";
  return (
    <div className="mme-kpis mme-time-kpis" style={{ "--kpi-cols": 3 } as React.CSSProperties} aria-live="polite">
      <div className="mme-kpi">
        <p>{titles.total}</p>
        <strong>{kpi.total}</strong>
        <span className="mme-kpi-pct"><small>{kpi.periodLabel} so far</small></span>
      </div>
      <div className="mme-kpi">
        <p>{titles.change}</p>
        <strong className={`mme-delta mme-delta--${direction}`}>
          {change === null ? "—" : <>{arrow} {Math.abs(change).toFixed(1)}%</>}
        </strong>
        <span className="mme-kpi-pct">
          <small>
            {change === null
              ? `No students in ${kpi.previousLabel}, so no percentage`
              : `${kpi.previousTotal} in ${kpi.previousLabel}`}
          </small>
        </span>
      </div>
      <div className="mme-kpi">
        <p>{titles.peak}</p>
        <strong>{kpi.peak ? kpi.peak.label : "—"}</strong>
        <span className="mme-kpi-pct"><small>{kpi.peak ? plural(kpi.peak.count, "student") : "No students yet"}</small></span>
      </div>
    </div>
  );
}

/** A real legend (not just colour): each entry shows the line style it names. */
function Legend({ view, series }: { view: TimeView; series: TimeSeries }) {
  const items =
    view === "year"
      ? [{ label: `${series.currentYear} (current year)`, style: "bar", color: ACCENT }, { label: "Earlier years", style: "bar", color: MUTED }]
      : view === "month"
        ? [{ label: String(series.currentYear), style: "solid", color: ACCENT }, { label: String(series.previousYear), style: "dashed", color: SECONDARY }]
        : view === "day"
        ? [{ label: "Daily count", style: "thin", color: RAW_LINE }, { label: `${MOVING_AVERAGE_DAYS}-day average`, style: "thick", color: AVERAGE_LINE }]
        : [{ label: "Weekly count", style: "thin", color: RAW_LINE }, { label: `${MOVING_AVERAGE_WEEKS}-week average`, style: "thick", color: AVERAGE_LINE }];
  return (
    <ul className="mme-time-legend" aria-label="Chart legend">
      {items.map((item) => (
        <li key={item.label}>
          <i className={`mme-time-swatch mme-time-swatch--${item.style}`} style={{ "--swatch": item.color } as React.CSSProperties} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

const yAxis = (
  <YAxis
    allowDecimals={false}
    domain={[0, (max: number) => Math.max(max, 1)]}
    tick={axisTick}
    tickLine={false}
    axisLine={false}
    width={44}
    label={{ value: "Number of students", angle: -90, position: "insideLeft", offset: 4, fill: AXIS_TEXT, fontSize: 11, style: { textAnchor: "middle" } }}
  />
);
/** Light horizontal gridlines only; no vertical lines on the time axis. */
const grid = <CartesianGrid vertical={false} stroke={GRID} />;
const cursor = { fill: "rgba(110, 160, 255, 0.06)" };
const margins = { top: 22, right: 16, bottom: 6, left: 4 };

function TimeChart({ view, series }: { view: TimeView; series: TimeSeries }) {
  const summary = chartSummary(view, series);
  const caption = `Students placed by ${view}`;
  return (
    <>
      <div className="mme-time-chart" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          {view === "year" ? (
            <BarChart data={series.years} margin={margins} barCategoryGap="22%">
              {grid}
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={8} />
              {yAxis}
              <Tooltip
                cursor={cursor}
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as (typeof series.years)[number] | undefined;
                  if (!active || !point) return null;
                  return <ChartTooltip title={point.label} value={plural(point.count, "student")} lines={[point.current ? "Current year, still in progress" : "Full year"]} />;
                }}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                {series.years.map((point) => <Cell key={point.year} fill={point.current ? ACCENT : MUTED} />)}
                <LabelList dataKey="count" position="top" fill={LABEL_TEXT} fontSize={11} />
              </Bar>
            </BarChart>
          ) : view === "month" ? (
            <LineChart data={series.months} margin={margins}>
              {grid}
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
              {yAxis}
              <Tooltip
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as (typeof series.months)[number] | undefined;
                  if (!active || !point) return null;
                  return (
                    <ChartTooltip
                      title={point.label}
                      value={point.current === null ? plural(point.previous, "student") : plural(point.current, "student")}
                      lines={point.current === null
                        ? [`${series.previousYear}: ${point.previous}`, `${series.currentYear}: not started`]
                        : [`${series.currentYear}: ${point.current}`, `${series.previousYear}: ${point.previous}`]}
                    />
                  );
                }}
              />
              <Line type="monotone" dataKey="previous" name={String(series.previousYear)} stroke={SECONDARY} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: SECONDARY, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="current" name={String(series.currentYear)} stroke={ACCENT} strokeWidth={3} dot={{ r: 3.5, fill: ACCENT, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          ) : view === "day" ? (
            <LineChart data={series.days} margin={margins}>
              {grid}
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: GRID }} interval={4} minTickGap={12} />
              {yAxis}
              <Tooltip
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as (typeof series.days)[number] | undefined;
                  if (!active || !point) return null;
                  return (
                    <ChartTooltip
                      title={`${weekOf(point.date)}${point.current ? " (today)" : ""}`}
                      value={plural(point.count, "student")}
                      lines={[`${MOVING_AVERAGE_DAYS}-day average: ${point.average.toFixed(1)}`]}
                    />
                  );
                }}
              />
              <Line type="monotone" dataKey="count" name="Daily count" stroke={RAW_LINE} strokeWidth={1.6} dot={{ r: 2.5, fill: RAW_LINE, strokeWidth: 0 }} activeDot={{ r: 4.5, fill: RAW_LINE, stroke: "#fff9d2", strokeWidth: 1.5 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="average" name={`${MOVING_AVERAGE_DAYS}-day average`} stroke={AVERAGE_LINE} strokeWidth={3} dot={false} activeDot={{ r: 5.5, fill: AVERAGE_LINE, stroke: "#fff9d2", strokeWidth: 1.5 }} isAnimationActive={false} />
            </LineChart>
          ) : (
            <LineChart data={series.weeks} margin={margins}>
              {grid}
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: GRID }} interval={Math.max(0, Math.ceil(series.weeks.length / 10) - 1)} />
              {yAxis}
              <Tooltip
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as (typeof series.weeks)[number] | undefined;
                  if (!active || !point) return null;
                  return (
                    <ChartTooltip
                      title={`${point.label} · week of ${weekOf(point.weekStart)}`}
                      value={plural(point.count, "student")}
                      lines={[point.average === null ? `${MOVING_AVERAGE_WEEKS}-week average: not enough weeks yet` : `${MOVING_AVERAGE_WEEKS}-week average: ${point.average.toFixed(1)}`]}
                    />
                  );
                }}
              />
              <Line type="monotone" dataKey="count" name="Weekly count" stroke={RAW_LINE} strokeWidth={1.6} dot={false} activeDot={{ r: 4, fill: RAW_LINE, stroke: "#fff9d2", strokeWidth: 1.5 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="average" name={`${MOVING_AVERAGE_WEEKS}-week average`} stroke={AVERAGE_LINE} strokeWidth={3} dot={false} activeDot={{ r: 5.5, fill: AVERAGE_LINE, stroke: "#fff9d2", strokeWidth: 1.5 }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <DataTable caption={caption} view={view} series={series} />
    </>
  );
}

const weekOf = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** The chart in words, for screen readers. */
function chartSummary(view: TimeView, series: TimeSeries): string {
  const kpi = series.kpis[view];
  const kind = view === "year" ? "Column chart of students placed per year" : view === "month" ? `Line chart of students placed per month, ${series.currentYear} against ${series.previousYear}` : view === "day" ? `Line chart of students placed per day over the last ${series.days.length} days with a ${MOVING_AVERAGE_DAYS}-day moving average` : `Line chart of students placed per week with a ${MOVING_AVERAGE_WEEKS}-week moving average`;
  return `${kind}. ${kpi.periodLabel}: ${kpi.total}. ${kpi.peak ? `Peak: ${kpi.peak.label} with ${kpi.peak.count}.` : "No students yet."}`;
}

/** The same values as the chart, for screen readers. */
function DataTable({ caption, view, series }: { caption: string; view: TimeView; series: TimeSeries }) {
  const columns = view === "year" ? ["Year", "Students"] : view === "month" ? ["Month", String(series.currentYear), String(series.previousYear)] : view === "day" ? ["Date", "Students", `${MOVING_AVERAGE_DAYS}-day average`] : ["Week", "Week starting", "Students", `${MOVING_AVERAGE_WEEKS}-week average`];
  const rows: (string | number)[][] =
    view === "year" ? series.years.map((point) => [point.label, point.count])
      : view === "month" ? series.months.map((point) => [point.label, point.current ?? "not started", point.previous])
        : view === "day" ? series.days.map((point) => [point.date, point.count, point.average.toFixed(1)])
        : series.weeks.map((point) => [point.label, point.weekStart, point.count, point.average === null ? "—" : point.average.toFixed(1)]);
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
    </table>
  );
}
