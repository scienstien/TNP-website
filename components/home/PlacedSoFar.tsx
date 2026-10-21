"use client";

/**
 * PlacedSoFar: students placed since 1 July vs the same period one year earlier.
 *
 * Styles are in PlacedSoFar.css (all classes start with "psf-"). Offer dates drive
 * the year-over-year comparison; batchStats drives the placement-rate wheel.
 *
 * Rules:
 * - Dates are "YYYY-MM-DD" strings. null = offer without a recorded date: not counted,
 *   reported in a note.
 * - The chosen date defaults to today (Asia/Kolkata unless `timeZone` is given) and cannot
 *   be in the future. 29 February is compared with 28 February of the year before.
 * - July–December dates belong to the following graduating batch; January–June dates belong to that calendar year.
 *   It compares that batch with exactly the preceding batch.
 * - Each side includes that batch's offers recorded through its cutoff date, regardless of when its placement season started.
 * - If the preceding batch has no dated offer, it shows "—" (missing), not 0.
 * - If the earlier count is 0, the % change is left out (no division by zero).
 * - Each tile shows how many distinct companies had made a dated offer to that batch
 *   by its cutoff date; "Compare companies" opens one pop-up listing every company, green if it came to
 *   only the current batch and red if it came only to the previous one. Visits without offers are not counted.
 */

import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from "react";
import { isValidIsoDate } from "@/lib/calendar/dates";
import {
  type BatchTrendPoint,
  batchTrend,
  batchYearForDate,
  dateInBatch,
  yearToDateComparison,
  type BatchOfferDate,
  type YearToDate,
  type YearToDateComparison,
} from "@/lib/placements/year-to-date";
import "./PlacedSoFar.css";

export interface PlacedSoFarProps {
  /** One entry per placed student, including the graduating batch used for scoping. */
  offers: ReadonlyArray<BatchOfferDate>;
  /** Placement totals per graduating batch. The percentage is placed / (placed + unplaced). */
  batches: ReadonlyArray<{
    batchYear: number;
    placed: number;
    unplaced: number;
  }>;
  /** Only admins may pick a batch; everyone else sees the batch of today's date. */
  canChooseBatch?: boolean;
  /**
   * Today's date as "YYYY-MM-DD". Pass it from the server in SSR apps (e.g. Next.js) to
   * avoid a hydration mismatch; otherwise it is computed in the browser.
   */
  today?: string;
  /** Time zone used to work out "today" when `today` is not given. */
  timeZone?: string;
  className?: string;
}

/* ------------------------------------------------------------------ view */

const todayIn = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());

const dayMonth = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

const periodLabel = (period: YearToDate) => `Batch ${period.batchYear}`;
function rippleClipPath(time: number) {
  const phase = time * 0.009;
  const amplitude = 2.4 + 0.5 * Math.sin(time * 0.002);
  const points = Array.from({ length: 17 }, (_, index) => {
    const y = -16 + index * 2;
    const x = amplitude * Math.sin(y * 0.26 - phase);
    return `${x.toFixed(2)} ${y}`;
  });
  return `M-600 -600 L0 -600 L0 -16 L${points.join(" L")} L0 16 L0 600 L-600 600 Z`;
}

function RollingPercentage({ value }: { value: number }) {
  const formatted = value.toFixed(1);
  let reelIndex = 0;
  return <strong className="psf-slot-number">
    {[...formatted].map((character, position) => {
      if (character === ".") return <span key={position} className="psf-slot-punctuation">.</span>;
      const index = reelIndex++;
      const finalStep = 30 + Number(character);
      return <span key={position} className="psf-slot-window">
        <span className="psf-slot-reel" style={{
          "--psf-slot-end": `-${finalStep}em`,
          animationDelay: `${index * 0.12}s`,
          animationDuration: `${3.5 - index * 0.12}s`,
        } as CSSProperties}>
          {Array.from({ length: finalStep + 1 }, (_, step) => <span key={step}>{step % 10}</span>)}
        </span>
      </span>;
    })}
    <span className="psf-slot-punctuation">%</span>
  </strong>;
}

/** The change line: direction in words, arrow and sign, never colour alone. */
function describeChange({
  current,
  previous,
  difference,
  pctChange,
}: YearToDateComparison): { tone: "good" | "bad" | "flat"; text: string } {
  if (previous.count === null || difference === null)
    return {
      tone: "flat",
      text: `No dated offers are recorded for ${periodLabel(previous)}, so there is nothing to compare.`,
    };
  if (previous.count === 0 && current.count === 0)
    return {
      tone: "flat",
      text: `No students placed by ${dayMonth(current.to)} in either year.`,
    };
  if (difference === 0)
    return { tone: "flat", text: `Level with ${periodLabel(previous)}.` };
  const students = `${difference > 0 ? "▲ +" : "▼ −"}${plural(Math.abs(difference), "student")}`;
  return {
    tone: difference > 0 ? "good" : "bad",
    text:
      pctChange === null
        ? `${students} · none by this date in ${periodLabel(previous)}`
        : `${students} · ${pctChange > 0 ? "+" : "−"}${Math.abs(pctChange).toFixed(1)}% vs ${periodLabel(previous)}`,
  };
}

type CompanyStatus = "both" | "new" | "missed";
type CompanyFilter = "all" | CompanyStatus;

const STATUS_LABEL: Record<CompanyStatus, string> = {
  both: "Came to both",
  new: "New this year",
  missed: "Not yet this year",
};

/**
 * One pop-up for the whole comparison: every company that had come to either batch by its
 * cutoff date, with a tick per batch. Green = came to the current batch but not the previous
 * one; red = came to the previous batch but not the current one (yet). Each state also has a
 * text label, so colour is never the only signal.
 */
function CompaniesDialog({
  current,
  previous,
  onClose,
}: {
  current: YearToDate;
  previous: YearToDate;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [filter, setFilter] = useState<CompanyFilter>("all");
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const rows = useMemo(() => {
    const now = new Set(current.companies ?? []);
    const before = new Set(previous.companies ?? []);
    return [...new Set([...now, ...before])].sort().map((name) => ({
      name,
      inCurrent: now.has(name),
      inPrevious: before.has(name),
      status: (now.has(name) ? (before.has(name) ? "both" : "new") : "missed") as CompanyStatus,
    }));
  }, [current.companies, previous.companies]);

  const counts = {
    all: rows.length,
    both: rows.filter((row) => row.status === "both").length,
    new: rows.filter((row) => row.status === "new").length,
    missed: rows.filter((row) => row.status === "missed").length,
  };
  const shown = filter === "all" ? rows : rows.filter((row) => row.status === filter);
  const close = () => dialogRef.current?.close();
  const tabs: Array<[CompanyFilter, string]> = [
    ["all", "All"],
    ["new", "New"],
    ["missed", "Not yet"],
    ["both", "Both"],
  ];

  return (
    <dialog
      ref={dialogRef}
      className="psf-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="psf-dialog-head">
        <div>
          <h3 id={titleId}>Companies that came</h3>
          <p>Offers dated up to {dayMonth(current.to)}, compared with the same date last year.</p>
        </div>
        <button type="button" className="psf-dialog-close" aria-label="Close" onClick={close}>×</button>
      </div>

      <div className="psf-dialog-tabs" role="group" aria-label="Filter companies">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`psf-tab psf-tab--${key}${filter === key ? " is-active" : ""}`}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label} <span>{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="psf-dialog-legend" aria-hidden="true">
        <span />
        <b>{periodLabel(previous)}</b>
        <b>{periodLabel(current)}</b>
      </div>
      {shown.length === 0 ? (
        <p className="psf-dialog-empty">No companies in this group.</p>
      ) : (
        <ul className="psf-dialog-list">
          {shown.map((row) => (
            <li key={row.name} className={`psf-company psf-company--${row.status}`}>
              <span className="psf-company-name">
                {row.name}
                <small>{STATUS_LABEL[row.status]}</small>
              </span>
              <span className="psf-mark" aria-label={`${periodLabel(previous)}: ${row.inPrevious ? "came" : "did not come"}`}>
                {row.inPrevious ? "✓" : "–"}
              </span>
              <span className="psf-mark" aria-label={`${periodLabel(current)}: ${row.inCurrent ? "came" : "did not come"}`}>
                {row.inCurrent ? "✓" : "–"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}

/**
 * Pop-up with the last 20 graduating batches at the same point of their season (the chosen day
 * and month in each batch's own July–June year), newest first. The two batches being compared
 * are highlighted. A batch without any dated offer shows "—", not 0.
 */
function TrendDialog({
  points,
  batch,
  compareBatch,
  onClose,
}: {
  points: BatchTrendPoint[];
  batch: number;
  compareBatch: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  const close = () => dialogRef.current?.close();
  const max = Math.max(1, ...points.map((point) => point.placed ?? 0));
  const cutoff = points[0] ? dayMonth(points[0].to) : "";

  return (
    <dialog
      ref={dialogRef}
      className="psf-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="psf-dialog-head">
        <div>
          <h3 id={titleId}>Last {points.length} batches</h3>
          <p>Students placed and companies that came, each batch counted up to {cutoff} of its own season.</p>
        </div>
        <button type="button" className="psf-dialog-close" aria-label="Close" onClick={close}>×</button>
      </div>
      <div className="psf-trend-legend" aria-hidden="true">
        <span>Batch</span>
        <span>Students placed</span>
        <span>Companies</span>
      </div>
      <ul className="psf-dialog-list">
        {points.map((point) => {
          const role = point.batchYear === batch ? "main" : point.batchYear === compareBatch ? "compare" : null;
          return (
            <li key={point.batchYear} className={`psf-trend-row${role ? ` psf-trend-row--${role}` : ""}`}>
              <span className="psf-trend-year">
                {point.batchYear}
                {role && <small>{role === "main" ? "selected" : "compared"}</small>}
              </span>
              <span className="psf-trend-bar" aria-label={`${point.placed ?? "no data"} placed`}>
                <i style={{ width: `${((point.placed ?? 0) / max) * 100}%` }} />
                <b>{point.placed ?? "—"}</b>
              </span>
              <span className="psf-trend-companies">{point.companies ?? "—"}</span>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}

export default function PlacedSoFar({
  batches,
  canChooseBatch = false,
  offers,
  today: todayProp,
  timeZone = "Asia/Kolkata",
  className = "",
}: PlacedSoFarProps) {
  const id = useId();
  const rippleClipId = `psf-ripple-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [today] = useState(() => todayProp ?? todayIn(timeZone));
  const [date, setDate] = useState(today);
  const rippleClipRef = useRef<SVGPathElement>(null);
  const [companiesOpen, setCompaniesOpen] = useState(false);
  const [trendOpen, setTrendOpen] = useState(false);
  // What the field shows while someone types; only a complete, valid date is applied.
  const [draft, setDraft] = useState(today);

  const defaultBatch = batchYearForDate(today);
  const [batch, setBatch] = useState(defaultBatch);
  // The batch compared against; admins can pick any other batch, everyone else gets the one before.
  const [compareBatch, setCompareBatch] = useState(defaultBatch - 1);
  // The cutoff must fall inside the chosen batch's July–June season; today caps the running one.
  const minDate = `${batch - 1}-07-01`;
  const maxDate = batch === defaultBatch ? today : `${batch}-06-30`;

  const choose = (next: string) => {
    setDraft(next);
    if (isValidIsoDate(next) && next >= minDate && next <= maxDate) setDate(next);
  };
  const chooseBatch = (next: number) => {
    const moved = dateInBatch(date, next);
    const limit = next === defaultBatch ? today : `${next}-06-30`;
    const applied = moved > limit ? limit : moved;
    // Choosing the batch that is currently compared against swaps the two.
    if (next === compareBatch) setCompareBatch(batch);
    setBatch(next);
    setDate(applied);
    setDraft(applied);
  };
  const reset = () => {
    setBatch(defaultBatch);
    setCompareBatch(defaultBatch - 1);
    setDate(today);
    setDraft(today);
  };
  const batchStats = batches.find((entry) => entry.batchYear === batch) ?? {
    batchYear: batch,
    placed: 0,
    unplaced: 0,
  };

  const compareOptions = [...new Set([...batches.map((entry) => entry.batchYear), compareBatch])]
    .filter((year) => year !== batch)
    .sort((a, b) => b - a);

  const trend = useMemo(
    () => (trendOpen ? batchTrend(offers, date, batch) : []),
    [trendOpen, offers, date, batch],
  );

  const comparison = useMemo(
    () => yearToDateComparison(offers, date, compareBatch),
    [offers, date, compareBatch],
  );
  const { current, previous, undated } = comparison;
  const change = describeChange(comparison);
  const batchTotal = batchStats.placed + batchStats.unplaced;
  const placementPct = batchTotal ? (batchStats.placed / batchTotal) * 100 : null;
  const filledArc = placementPct ?? 0;
  const arcAngle = (Math.PI * filledArc) / 100;
  const rippleX = 160 - 140 * Math.cos(arcAngle);
  const rippleY = 176 - 140 * Math.sin(arcAngle);
  const rippleRotation = (180 * filledArc) / 100 - 90;
  const hasRipple = filledArc > 0 && filledArc < 100;
  const visibleArc = hasRipple ? Math.min(100, filledArc + 3) : filledArc;

  useEffect(() => {
    if (!hasRipple) return;
    const clip = rippleClipRef.current;
    if (!clip) return;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | null = null;
    let lastFrame = 0;

    const animate = (time: number) => {
      if (time - lastFrame >= 30) {
        clip.setAttribute("d", rippleClipPath(time));
        lastFrame = time;
      }
      frame = window.requestAnimationFrame(animate);
    };
    const updateMotion = () => {
      if (motionPreference.matches) {
        if (frame !== null) window.cancelAnimationFrame(frame);
        frame = null;
        clip.setAttribute("d", rippleClipPath(0));
      } else if (frame === null) {
        frame = window.requestAnimationFrame(animate);
      }
    };
    motionPreference.addEventListener("change", updateMotion);
    updateMotion();
    return () => {
      motionPreference.removeEventListener("change", updateMotion);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [hasRipple]);

  const columns = [
    {
      period: current,
      count: String(current.count),
      companyList: current.companies,
      lead: true,
    },
    {
      period: previous,
      count: previous.count === null ? "—" : String(previous.count),
      companyList: previous.companies,
      lead: false,
    },
  ];

  return (
    <section
      className={`psf ${className}`}
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`} className="psf-title">
        Batch stats
      </h2>

      <div className="psf-comparison-heading">
        {compareBatch === batch - 1 ? "Year-over-year placements" : "Batch comparison"}
      </div>
      <div className="psf-picker">
        {canChooseBatch && (
          <>
            <label htmlFor={`${id}-batch`}>Batch</label>
            <select
              id={`${id}-batch`}
              value={batch}
              onChange={(event) => chooseBatch(Number(event.target.value))}
            >
              {batches.map((entry) => (
                <option key={entry.batchYear} value={entry.batchYear}>
                  {entry.batchYear}
                </option>
              ))}
            </select>
            <span className="psf-vs">vs</span>
            <select
              aria-label="Compare with batch"
              value={compareBatch}
              onChange={(event) => setCompareBatch(Number(event.target.value))}
            >
              {compareOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </>
        )}
        <label htmlFor={`${id}-date`}>From 1 Jul to</label>
        <input
          id={`${id}-date`}
          type="date"
          value={draft}
          max={maxDate}
          min={minDate}
          onChange={(event) => choose(event.target.value)}
          // Leaving the field with an incomplete or future date shows the applied date again.
          onBlur={() => setDraft(date)}
        />
        {(date !== today || batch !== defaultBatch) && (
          <button
            type="button"
            className="psf-today"
            onClick={reset}
          >
            Today
          </button>
        )}
      </div>

      <div className="psf-figures" aria-live="polite">
        {columns.map(({ period, count, companyList, lead }) => (
          <div
            key={period.batchYear}
            className={lead ? "psf-figure is-lead" : "psf-figure"}
          >
          <span>{periodLabel(period)}</span>
            <strong>{count}</strong>
            <small className="psf-figure-caption">students placed</small>
            <p className="psf-figure-companies">
              <b>{companyList === null ? "—" : companyList.length}</b>{" "}
              {companyList?.length === 1 ? "company" : "companies"} came
            </p>
          </div>
        ))}
        <p className={`psf-change psf-change--${change.tone}`}>
          {change.text}
        </p>
        {previous.companies !== null && (
          <button type="button" className="psf-companies-open" onClick={() => setCompaniesOpen(true)}>
            Compare companies <span aria-hidden="true">›</span>
          </button>
        )}
        {canChooseBatch && (
          <button type="button" className="psf-companies-open" onClick={() => setTrendOpen(true)}>
            Last 20 batches <span aria-hidden="true">›</span>
          </button>
        )}
      </div>

      {trendOpen && (
        <TrendDialog
          points={trend}
          batch={batch}
          compareBatch={compareBatch}
          onClose={() => setTrendOpen(false)}
        />
      )}

      {companiesOpen && (
        <CompaniesDialog
          current={current}
          previous={previous}
          onClose={() => setCompaniesOpen(false)}
        />
      )}

      {undated > 0 && <p className="psf-note">{plural(undated, "undated offer")} excluded from the comparison.</p>}

      <div className="psf-placement" aria-label={`Batch ${batchStats.batchYear} placement rate`}>
        <div className="psf-placement-summary">
          <strong>Batch {batchStats.batchYear} placement</strong>
          <span><i className="psf-legend-placed" />{batchStats.placed} placed</span>
          <span><i className="psf-legend-unplaced" />{batchStats.unplaced} unplaced</span>
        </div>
        <div className="psf-donut-wrap">
          <svg className="psf-donut" viewBox="0 0 320 176" role="img" aria-label={placementPct === null ? "No recorded students" : `${placementPct.toFixed(1)} percent placed`}>
            {hasRipple && <defs>
              <clipPath id={rippleClipId} clipPathUnits="userSpaceOnUse">
                <path ref={rippleClipRef} transform={`translate(${rippleX} ${rippleY}) rotate(${rippleRotation})`} d={rippleClipPath(0)} />
              </clipPath>
            </defs>}
            <path className="psf-donut-track" d="M20 176 A140 140 0 0 1 300 176" pathLength="100" />
            {filledArc > 0 && <g clipPath={hasRipple ? `url(#${rippleClipId})` : undefined}>
              <path key={`${batchStats.batchYear}-${filledArc}`} className="psf-donut-fill" d="M20 176 A140 140 0 0 1 300 176" pathLength="100" style={{ "--psf-filled-arc": visibleArc } as CSSProperties} />
            </g>}
          </svg>
          <div className="psf-donut-value" aria-hidden="true">
            {placementPct === null ? <strong>—</strong> :
              <RollingPercentage key={`${batchStats.batchYear}-${placementPct.toFixed(1)}`} value={placementPct} />}
          </div>
        </div>
      </div>
    </section>
  );
}
