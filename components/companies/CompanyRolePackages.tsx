"use client";
import type { CompanyRolePackageRow, CompensationSummary } from "@/lib/companies/offer-summaries";
import { numberDuplicates } from "@/lib/drives/labels";
import styles from "./CompanySummary.module.css";

function Summary({ value, total, unit, label }: { value: CompensationSummary; total: number; unit: string; label: string }) {
  const display = (amount: number) => amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const coverage = total === 0 ? 0 : Math.round(value.knownCount / total * 100);
  return <div className={styles.metric}>
    <span className={styles.metricLabel}>{label}</span>
    <strong>{value.median === null ? "Not recorded" : <>{display(value.median)} <small>{unit}</small></>}</strong>
    <span>{value.median === null ? "No recorded amount" : `Range ${display(value.minimum!)}–${display(value.maximum!)} ${unit}`}</span>
    <span className={styles.coverage}>{value.knownCount} of {total} known · {coverage}% coverage</span>
  </div>;
}

export default function CompanyRolePackages({ rows, active, loading, error, onRetry }: {
  rows: CompanyRolePackageRow[]; active: boolean; loading: boolean; error: string | null; onRetry: () => void;
}) {
  const offeredRows = rows.filter(row => row.offerCount > 0);
  // Domain and drive reference; repeated combinations of the same title get "(1)", "(2)".
  const details = offeredRows.map(row => `${row.domain?.trim() || "Domain not recorded"} · ${row.driveReference?.trim() || "No drive reference"}`);
  const identities = numberDuplicates(details, offeredRows.map((row, index) => `${row.jobTitle ?? ""} · ${details[index]}`));
  return <section className={styles.card}><header className={styles.cardHeader}><div><p className={styles.kicker}>COMPENSATION</p><h2>Actual offers by role</h2><p>Median and recorded range for final offers. Missing amounts are excluded.</p></div></header>
    {loading ? <p role="status" className={styles.state}>Loading compensation summaries…</p> : error ? <p role="alert" className={styles.error}>{error} <button onClick={onRetry}>Retry</button></p> : !active ? <p className={styles.state}>Select a company and placement cycle.</p> :
      !offeredRows.length ? <p className={styles.state}>No final offers are recorded for this company and cycle.</p> : <div className={styles.roleCards} role="list" aria-label="Actual offer compensation by role">{offeredRows.map((row, index) => {
        const identity = row.roleId ? identities[index] : "Offers without a recorded role";
        return <article className={styles.roleCard} role="listitem" key={row.roleId ?? "missing"}>
          <header><div><h3>{row.roleId ? row.jobTitle ?? "Unspecified title" : "No role recorded"}</h3><p>{identity}</p></div><span className={styles.offerCount}><strong>{row.offerCount}</strong>{row.offerCount === 1 ? "offer" : "offers"}</span></header>
          <div className={styles.metrics}><Summary label="Annual package median" value={row.package} total={row.offerCount} unit="LPA" /></div>
        </article>;
      })}</div>}
  </section>;
}
