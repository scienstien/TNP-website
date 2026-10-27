"use client";
import styles from "./CompanySummary.module.css";
import type { CompanyOfferTypeSummary, CompanyRolePackageRow } from "@/lib/companies/offer-summaries";
import { numberDuplicates, roleName } from "@/lib/drives/labels";

export default function CompanyOfferTypes({ types, total, active, loading, error, onRetry, roles, roleId, onRoleChange }: {
  types: CompanyOfferTypeSummary[]; total: number; active: boolean; loading: boolean; error: string | null; onRetry: () => void;
  roles: CompanyRolePackageRow[]; roleId: string | null; onRoleChange: (id: string | null) => void;
}) {
  const mismatch = types.some(type => !Number.isSafeInteger(type.count) || type.count < 0) || types.reduce((sum, type) => sum + type.count, 0) !== total;
  return <section className={styles.card}><header className={styles.cardHeader}><div><h2>Offer types</h2></div>{active && <label className={styles.roleFilter}>Role<select value={roleId ?? ""} onChange={event => onRoleChange(event.target.value || null)}><option value="">All roles</option>{roleLabels(roles.filter(role => role.roleId !== null)).map(([role, label]) => <option key={role.roleId} value={role.roleId!}>{label}</option>)}</select></label>}</header>
    {loading ? <p role="status" className={styles.state}>Loading offer types…</p> : error || mismatch ? <p role="alert" className={styles.error}>{error ?? "These figures don't add up; please refresh or report this."} <button onClick={onRetry}>Retry</button></p> : !active ? <p className={styles.state}>Select a company and placement cycle.</p> : !total ? <p className={styles.state}>No offers recorded.</p> :
      <div className={styles.typeSummary}>
        <div className={styles.total}><strong>{total}</strong><span>final {total === 1 ? "offer" : "offers"}</span></div>
        <div className={styles.typeTiles}>{types.map((type) => { const percentage = type.count / total * 100; return <article key={type.key} className={styles.typeTile}>
          <div className={styles.typeTileHeader}><b>{type.label}</b><strong>{type.count}</strong></div>
          <div className={styles.typeShare}>{percentage.toFixed(1)}% of all offers</div>
          <div className={styles.typeDetails}>
            <span><small>Annual package</small><b>{formatCompensation(type.package, "LPA", "Not recorded")}</b></span>
            <span><small>Monthly stipend</small><b>{formatCompensation(type.stipend, "INR/mo", "Not recorded")}</b></span>
          </div>
          <span className={styles.srOnly}>{type.label}: {type.count} of {total}</span>
        </article>; })}</div>
      </div>}
  </section>;
}

function formatCompensation(summary: CompanyOfferTypeSummary["package"], unit: string, missingLabel: string): string {
  if (summary.knownCount === 0 || summary.median === null) return missingLabel;
  const median = Number.isInteger(summary.median) ? String(summary.median) : summary.median.toFixed(1);
  return `${median} ${unit}`;
}

/** Title, domain and drive reference; identical labels get "(1)", "(2)" instead of an internal ID. */
function roleLabels(roles: CompanyRolePackageRow[]): [CompanyRolePackageRow, string][] {
  const labels = numberDuplicates(roles.map(role => `${roleName(role)} · ${role.driveReference?.trim() || "No drive reference"}`));
  return roles.map((role, index) => [role, labels[index]]);
}
