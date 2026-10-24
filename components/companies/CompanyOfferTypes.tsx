"use client";
import styles from "./CompanySummary.module.css";
import type { CompanyRolePackageRow } from "@/lib/companies/offer-summaries";

export default function CompanyOfferTypes({ types, total, active, loading, error, onRetry, roles, roleId, onRoleChange }: {
  types: { key: string; label: string; count: number }[]; total: number; active: boolean; loading: boolean; error: string | null; onRetry: () => void;
  roles: CompanyRolePackageRow[]; roleId: string | null; onRoleChange: (id: string | null) => void;
}) {
  const mismatch = types.some(type => !Number.isSafeInteger(type.count) || type.count < 0) || types.reduce((sum, type) => sum + type.count, 0) !== total;
  const palette = ["#3a72e6", "#22a08c", "#9b6fe0", "#f59e0b"];
  return <section className={styles.card}><header className={styles.cardHeader}><div><p className={styles.kicker}>OFFER MIX</p><h2>Offer types</h2><p>Final reported PPO, FTE and FTE+6month offers in the selected cycle.</p></div>{active && <label className={styles.roleFilter}>Role<select value={roleId ?? ""} onChange={event => onRoleChange(event.target.value || null)}><option value="">All roles</option>{roles.filter(role => role.roleId !== null).map(role => <option key={role.roleId} value={role.roleId!}>{rowLabel(role)}</option>)}</select></label>}</header>
    {loading ? <p role="status" className={styles.state}>Loading offer types…</p> : error || mismatch ? <p role="alert" className={styles.error}>{error ?? "These figures don't add up; please refresh or report this."} <button onClick={onRetry}>Retry</button></p> : !active ? <p className={styles.state}>Select a company and placement cycle.</p> : !total ? <p className={styles.state}>No offers recorded.</p> :
      <div className={styles.typeSummary}>
        <div className={styles.total}><strong>{total}</strong><span>final {total === 1 ? "offer" : "offers"}</span></div>
        <div className={styles.typeBar} aria-label="Offer-type proportions">{types.map((type, index) => <span key={type.key} style={{ width: `${type.count / total * 100}%`, backgroundColor: palette[index % palette.length] }} title={`${type.label}: ${type.count}`} />)}</div>
        <div className={styles.typeTiles}>{types.map((type, index) => { const percentage = type.count / total * 100; return <article key={type.key} className={styles.typeTile}>
          <span className={styles.typeSwatch} style={{ backgroundColor: palette[index % palette.length] }} aria-hidden="true" />
          <span><b>{type.label}</b><small>{percentage.toFixed(1)}% of recorded offers</small></span><strong>{type.count}</strong>
          <span className={styles.srOnly}>{type.label}: {type.count} of {total}</span>
        </article>; })}</div>
      </div>}
  </section>;
}

function rowLabel(role: CompanyRolePackageRow) {
  return `${role.jobTitle ?? "Unspecified title"} · ${role.driveReference ?? "No drive reference"} · ${role.roleId!.slice(0, 8)}`;
}
