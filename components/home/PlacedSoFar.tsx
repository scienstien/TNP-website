"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { HomeCycleSummary } from "@/lib/placements/home-cycle";
import "./PlacedSoFar.css";

export interface PlacedSoFarProps {
  cycles: ReadonlyArray<HomeCycleSummary>;
  className?: string;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

const cycleLabel = (cycle: HomeCycleSummary) => `Cycle ${cycle.cycleCode}`;

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
  const [primaryId, setPrimaryId] = useState("");
  const [comparisonId, setComparisonId] = useState("");
  const [companiesOpen, setCompaniesOpen] = useState(false);

  const primary = cycles.find((cycle) => cycle.cycleId === primaryId) ?? null;
  const comparison = cycles.find((cycle) => cycle.cycleId === comparisonId) ?? null;
  const total = primary ? primary.placed + primary.unplaced : 0;
  const placementPct = primary && total ? (primary.placed / total) * 100 : null;
  const companyDiff = primary && comparison ? {
    onlyPrimary: primary.companies.filter((name) => !comparison.companies.includes(name)).length,
    onlyComparison: comparison.companies.filter((name) => !primary.companies.includes(name)).length,
    shared: primary.companies.filter((name) => comparison.companies.includes(name)).length,
  } : null;

  const selectPrimary = (cycleId: string) => {
    setPrimaryId(cycleId);
    if (!cycleId || cycleId === comparisonId) setComparisonId("");
    setCompaniesOpen(false);
  };
  const change = primary && comparison ? describeChange(primary, comparison) : null;

  return <section className={`psf ${className}`} aria-labelledby={`${id}-title`}>
    <div className="psf-heading">
      <h2 id={`${id}-title`} className="psf-title">Cycle comparison</h2>
    </div>
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

    <div className="psf-results">
      {!primary && <div className="psf-empty" role="status">
        <p>{cycles.length ? "Select a cycle to view outcomes." : "No placement cycles recorded."}</p>
      </div>}
      {primary && <div className="psf-comparison">
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
          {change?.text ?? "Select another cycle to compare."}
        </p>
      </div>

      {companyDiff && comparison && <div className="psf-company-diff">
        <span className="psf-company-diff--primary">{companyDiff.onlyPrimary} only in {primary.cycleCode}</span>
        <span className="psf-company-diff--comparison">{companyDiff.onlyComparison} only in {comparison.cycleCode}</span>
        <span className="psf-company-diff--shared">{companyDiff.shared} in both</span>
        <button type="button" className="psf-companies-open" onClick={() => setCompaniesOpen(true)}>
          View companies <span aria-hidden="true">›</span>
        </button>
      </div>}

      {companiesOpen && comparison && <CompaniesDialog
        primary={primary}
        comparison={comparison}
        onClose={() => setCompaniesOpen(false)}
      />}
      </div>}

      <div className="psf-placement" aria-label={primary ? `${cycleLabel(primary)} placement rate` : "Placement rate"}>
        <div className="psf-placement-heading">
          <div>
            <strong>Placement rate</strong>
            {primary && <small>{cycleLabel(primary)}</small>}
            <small>Placed ÷ registered students</small>
          </div>
        </div>
        <div className="psf-donut-wrap">
          <svg className="psf-donut" viewBox="0 0 320 180" role="img" aria-label={placementPct === null ? "Placement rate unavailable" : `${placementPct.toFixed(1)} percent of registered students placed`}>
            <path className="psf-donut-track" d="M20 160 A140 140 0 0 1 300 160" pathLength="100" />
            {placementPct !== null && placementPct > 0 && <path className="psf-donut-fill" d="M20 160 A140 140 0 0 1 300 160" pathLength="100" strokeDasharray={`${placementPct} 100`} />}
          </svg>
          <strong className="psf-donut-value">{placementPct === null ? "—" : `${placementPct.toFixed(1)}%`}</strong>
        </div>
        {primary && <div className="psf-placement-summary">
          <span><i className="psf-legend-placed" />{primary.placed} placed</span>
          <span><i className="psf-legend-unplaced" />{primary.unplaced} unplaced</span>
        </div>}
      </div>
    </div>
  </section>;
}
