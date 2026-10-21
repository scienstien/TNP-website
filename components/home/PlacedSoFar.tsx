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
 */

import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from "react";
import { isValidIsoDate } from "@/lib/calendar/dates";
import {
  yearToDateComparison,
  type BatchOfferDate,
  type YearToDate,
  type YearToDateComparison,
} from "@/lib/placements/year-to-date";
import "./PlacedSoFar.css";

export interface PlacedSoFarProps {
  /** One entry per placed student, including the graduating batch used for scoping. */
  offers: ReadonlyArray<BatchOfferDate>;
  /** Current-batch placement totals. The percentage is placed / (placed + unplaced). */
  batchStats: {
    batchYear: number;
    placed: number;
    unplaced: number;
  };
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

export default function PlacedSoFar({
  batchStats,
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
  // What the field shows while someone types; only a complete, valid date is applied.
  const [draft, setDraft] = useState(today);

  const choose = (next: string) => {
    setDraft(next);
    if (isValidIsoDate(next) && next <= today && next >= "2000-01-01")
      setDate(next);
  };

  const comparison = useMemo(
    () => yearToDateComparison(offers, date),
    [offers, date],
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
    { period: current, count: String(current.count), lead: true },
    {
      period: previous,
      count: previous.count === null ? "—" : String(previous.count),
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

      <div className="psf-comparison-heading">Year-over-year placements</div>
      <div className="psf-picker">
        <label htmlFor={`${id}-date`}>From 1 Jul to</label>
        <input
          id={`${id}-date`}
          type="date"
          value={draft}
          max={today}
          min="2000-01-01"
          onChange={(event) => choose(event.target.value)}
          // Leaving the field with an incomplete or future date shows the applied date again.
          onBlur={() => setDraft(date)}
        />
        {date !== today && (
          <button
            type="button"
            className="psf-today"
            onClick={() => choose(today)}
          >
            Today
          </button>
        )}
      </div>

      <div className="psf-figures" aria-live="polite">
        {columns.map(({ period, count, lead }) => (
          <div
            key={period.batchYear}
            className={lead ? "psf-figure is-lead" : "psf-figure"}
          >
          <span>{periodLabel(period)}</span>
            <strong>{count}</strong>
          </div>
        ))}
        <p className={`psf-change psf-change--${change.tone}`}>
          {change.text}
        </p>
      </div>

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
