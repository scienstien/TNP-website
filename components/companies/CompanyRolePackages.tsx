"use client";
import type { CompanyRolePackageRow, CompensationSummary } from "@/lib/companies/offer-summaries";
import styles from "./CompanySummary.module.css";

function Summary({ value, total, unit }: { value: CompensationSummary; total: number; unit: string }) {
  const display = (amount: number) => amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return <>{value.median === null ? "Not recorded" : <>Median {display(value.median)} {unit}; range {display(value.minimum!)}–{display(value.maximum!)} {unit}</>}
    <small> ({value.knownCount} of {total} known)</small></>;
}

export default function CompanyRolePackages({ rows, active, loading, error, onRetry }: {
  rows: CompanyRolePackageRow[]; active: boolean; loading: boolean; error: string | null; onRetry: () => void;
}) {
  return <section className={styles.card}><h2>Actual offers by role</h2><p>Final reported offers. Annual package and monthly stipend are summarized separately; missing amounts are excluded.</p>
    {loading ? <p role="status">Loading compensation summaries…</p> : error ? <p role="alert">{error} <button onClick={onRetry}>Retry</button></p> : !active ? <p>Select a company and placement cycle.</p> :
      <div className={styles.scroll} tabIndex={0} role="region" aria-label="Actual offer compensation by role"><table><thead><tr><th>Role / drive</th><th>Offers</th><th>Annual package (₹ LPA)</th><th>Monthly stipend (₹/month)</th></tr></thead><tbody>{rows.map(row =>
        <tr key={row.roleId ?? "missing"}><td>{row.roleId ? <>{row.jobTitle ?? "Unspecified title"}<small>{row.driveReference ?? "No reference"} · Drive {row.driveId} · Role {row.roleId}</small></> : "No role recorded"}</td><td>{row.offerCount}</td><td><Summary value={row.package} total={row.offerCount} unit="LPA" /></td><td><Summary value={row.stipend} total={row.offerCount} unit="INR/month" /></td></tr>)}</tbody></table></div>}
  </section>;
}
