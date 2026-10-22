"use client";

import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from "react";
import type { HomeCycleSummary } from "@/lib/placements/home-cycle";
import "./PlacedSoFar.css";

export interface PlacedSoFarProps {
  cycles: ReadonlyArray<HomeCycleSummary>;
  className?: string;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

const cycleLabel = (cycle: HomeCycleSummary) => `Cycle ${cycle.cycleCode}`;

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

type CompanyStatus = "both" | "primary" | "comparison";

function CompaniesDialog({
  primary,
  comparison,
  onClose,
}: {
  primary: HomeCycleSummary;
  comparison: HomeCycleSummary;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [filter, setFilter] = useState<"all" | CompanyStatus>("all");
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const rows = useMemo(() => {
    const primaryCompanies = new Set(primary.companies);
    const comparisonCompanies = new Set(comparison.companies);
    return [...new Set([...primaryCompanies, ...comparisonCompanies])]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => {
        const inPrimary = primaryCompanies.has(name);
        const inComparison = comparisonCompanies.has(name);
        return {
          name,
          inPrimary,
          inComparison,
          status: (inPrimary && inComparison
            ? "both"
            : inPrimary ? "primary" : "comparison") as CompanyStatus,
        };
      });
  }, [primary, comparison]);
  const shown = filter === "all" ? rows : rows.filter((row) => row.status === filter);
  const tabs: Array<[typeof filter, string]> = [
    ["all", "All"],
    ["primary", `Only ${primary.cycleCode}`],
    ["comparison", `Only ${comparison.cycleCode}`],
    ["both", "Both"],
  ];

  return <dialog
    ref={dialogRef}
    className="psf-dialog"
    aria-labelledby={titleId}
    onClose={onClose}
    onClick={(event) => {
      if (event.target === event.currentTarget) dialogRef.current?.close();
    }}
  >
    <div className="psf-dialog-head">
      <div>
        <h3 id={titleId}>Companies with offers</h3>
        <p>{cycleLabel(primary)} compared with {cycleLabel(comparison)}.</p>
      </div>
      <button type="button" className="psf-dialog-close" aria-label="Close" onClick={() => dialogRef.current?.close()}>×</button>
    </div>
    <div className="psf-dialog-tabs" role="group" aria-label="Filter companies">
      {tabs.map(([key, label]) => (
        <button key={key} type="button" className={`psf-tab psf-tab--${key}${filter === key ? " is-active" : ""}`}
          aria-pressed={filter === key} onClick={() => setFilter(key)}>
          {label} <span>{key === "all" ? rows.length : rows.filter((row) => row.status === key).length}</span>
        </button>
      ))}
    </div>
    <div className="psf-dialog-legend" aria-hidden="true">
      <span />
      <b>{primary.cycleCode}</b>
      <b>{comparison.cycleCode}</b>
    </div>
    {shown.length === 0 ? <p className="psf-dialog-empty">No companies in this group.</p> : (
      <ul className="psf-dialog-list">
        {shown.map((row) => <li key={row.name} className={`psf-company psf-company--${row.status}`}>
          <span className="psf-company-name">{row.name}</span>
          <span className="psf-mark" aria-label={`${primary.cycleCode}: ${row.inPrimary ? "offer recorded" : "no offer recorded"}`}>
            {row.inPrimary ? "✓" : "–"}
          </span>
          <span className="psf-mark" aria-label={`${comparison.cycleCode}: ${row.inComparison ? "offer recorded" : "no offer recorded"}`}>
            {row.inComparison ? "✓" : "–"}
          </span>
        </li>)}
      </ul>
    )}
  </dialog>;
}

function describeChange(primary: HomeCycleSummary, comparison: HomeCycleSummary): {
  tone: "good" | "bad" | "flat";
  text: string;
} {
  const difference = primary.placed - comparison.placed;
  if (difference === 0) return {
    tone: "flat",
    text: `Level with ${cycleLabel(comparison)}.`,
  };
  const students = `${difference > 0 ? "▲ +" : "▼ −"}${plural(Math.abs(difference), "student")}`;
  const percentage = comparison.placed === 0
    ? "comparison cycle recorded no placed students"
    : `${difference > 0 ? "+" : "−"}${Math.abs((difference / comparison.placed) * 100).toFixed(1)}% vs ${cycleLabel(comparison)}`;
  return {
    tone: difference > 0 ? "good" : "bad",
    text: `${students} · ${percentage}`,
  };
}

export default function PlacedSoFar({ cycles, className = "" }: PlacedSoFarProps) {
  const id = useId();
  const rippleClipId = `psf-ripple-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const rippleClipRef = useRef<SVGPathElement>(null);
  const [primaryId, setPrimaryId] = useState("");
  const [comparisonId, setComparisonId] = useState("");
  const [companiesOpen, setCompaniesOpen] = useState(false);

  const primary = cycles.find((cycle) => cycle.cycleId === primaryId) ?? null;
  const comparison = cycles.find((cycle) => cycle.cycleId === comparisonId) ?? null;
  const total = primary ? primary.placed + primary.unplaced : 0;
  const placementPct = primary && total ? (primary.placed / total) * 100 : null;
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
      } else if (frame === null) frame = window.requestAnimationFrame(animate);
    };
    motionPreference.addEventListener("change", updateMotion);
    updateMotion();
    return () => {
      motionPreference.removeEventListener("change", updateMotion);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [hasRipple]);

  const selectPrimary = (cycleId: string) => {
    setPrimaryId(cycleId);
    if (!cycleId || cycleId === comparisonId) setComparisonId("");
    setCompaniesOpen(false);
  };
  const change = primary && comparison ? describeChange(primary, comparison) : null;

  return <section className={`psf ${className}`} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`} className="psf-title">Placement cycle stats</h2>
    <div className="psf-comparison-heading">Cycle comparison</div>
    <div className="psf-picker">
      <label htmlFor={`${id}-primary-cycle`}>Primary cycle</label>
      <select id={`${id}-primary-cycle`} value={primaryId} onChange={(event) => selectPrimary(event.target.value)}>
        <option value="">Select cycle</option>
        {cycles.map((cycle) => <option key={cycle.cycleId} value={cycle.cycleId}>{cycle.cycleCode}</option>)}
      </select>
      <span className="psf-vs">vs</span>
      <label className="sr-only" htmlFor={`${id}-comparison-cycle`}>Comparison cycle</label>
      <select id={`${id}-comparison-cycle`} value={comparisonId} disabled={!primary}
        onChange={(event) => { setComparisonId(event.target.value); setCompaniesOpen(false); }}>
        <option value="">Select comparison</option>
        {cycles.filter((cycle) => cycle.cycleId !== primaryId).map((cycle) => (
          <option key={cycle.cycleId} value={cycle.cycleId}>{cycle.cycleCode}</option>
        ))}
      </select>
    </div>

    {!cycles.length && <p className="psf-note">No placement cycles are available.</p>}
    {primary && <>
      <div className="psf-figures" aria-live="polite">
        {[primary, comparison].map((cycle, index) => cycle ? (
          <div key={cycle.cycleId} className={index === 0 ? "psf-figure is-lead" : "psf-figure"}>
            <span>{cycleLabel(cycle)}</span>
            <strong>{cycle.placed}</strong>
            <small className="psf-figure-caption">registered students placed</small>
            <p className="psf-figure-companies">
              <b>{cycle.companies.length}</b> {cycle.companies.length === 1 ? "company" : "companies"} with offers
            </p>
          </div>
        ) : (
          <div key="comparison-empty" className="psf-figure">
            <span>Comparison cycle</span>
            <strong>—</strong>
            <small className="psf-figure-caption">Select another cycle</small>
          </div>
        ))}
        <p className={`psf-change psf-change--${change?.tone ?? "flat"}`}>
          {change?.text ?? "Select a comparison cycle to see the change."}
        </p>
        {comparison && <button type="button" className="psf-companies-open" onClick={() => setCompaniesOpen(true)}>
          Compare companies with offers <span aria-hidden="true">›</span>
        </button>}
      </div>

      {companiesOpen && comparison && <CompaniesDialog
        primary={primary}
        comparison={comparison}
        onClose={() => setCompaniesOpen(false)}
      />}

      <div className="psf-placement" aria-label={`${cycleLabel(primary)} placement rate`}>
        <div className="psf-placement-summary">
          <strong>{cycleLabel(primary)} placement</strong>
          <span><i className="psf-legend-placed" />{primary.placed} placed</span>
          <span><i className="psf-legend-unplaced" />{primary.unplaced} unplaced</span>
        </div>
        <div className="psf-donut-wrap">
          <svg className="psf-donut" viewBox="0 0 320 176" role="img"
            aria-label={placementPct === null ? "No registered students" : `${placementPct.toFixed(1)} percent of registered students placed`}>
            {hasRipple && <defs><clipPath id={rippleClipId} clipPathUnits="userSpaceOnUse">
              <path ref={rippleClipRef} transform={`translate(${rippleX} ${rippleY}) rotate(${rippleRotation})`} d={rippleClipPath(0)} />
            </clipPath></defs>}
            <path className="psf-donut-track" d="M20 176 A140 140 0 0 1 300 176" pathLength="100" />
            {filledArc > 0 && <g clipPath={hasRipple ? `url(#${rippleClipId})` : undefined}>
              <path key={`${primary.cycleId}-${filledArc}`} className="psf-donut-fill"
                d="M20 176 A140 140 0 0 1 300 176" pathLength="100"
                style={{ "--psf-filled-arc": visibleArc } as CSSProperties} />
            </g>}
          </svg>
          <div className="psf-donut-value" aria-hidden="true">
            {placementPct === null ? <strong>—</strong> :
              <RollingPercentage key={`${primary.cycleId}-${placementPct.toFixed(1)}`} value={placementPct} />}
          </div>
        </div>
      </div>
    </>}
  </section>;
}
