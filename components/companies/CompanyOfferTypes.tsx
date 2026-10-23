"use client";
import styles from "./CompanySummary.module.css";
import type { CompanyRolePackageRow } from "@/lib/companies/offer-summaries";

export default function CompanyOfferTypes({ types, total, active, loading, error, onRetry, roles, roleId, onRoleChange }: {
  types: { key: string; label: string; count: number }[]; total: number; active: boolean; loading: boolean; error: string | null; onRetry: () => void;
  roles: CompanyRolePackageRow[]; roleId: string | null; onRoleChange: (id: string | null) => void;
}) {
  const mismatch = types.some(type => !Number.isSafeInteger(type.count) || type.count < 0) || types.reduce((sum, type) => sum + type.count, 0) !== total;
  return <section className={styles.card}><h2>Offer types</h2><p>Final reported PPO, FTE and FTE+6month offers in the selected cycle.</p>
    {active && <label>Role <select value={roleId ?? ""} onChange={event => onRoleChange(event.target.value || null)}><option value="">All roles</option>{roles.filter(role => role.roleId !== null).map(role => <option key={role.roleId} value={role.roleId!}>{role.jobTitle ?? "Unspecified title"} · {role.driveReference ?? role.driveId} · {role.roleId}</option>)}</select></label>}
    {loading ? <p role="status">Loading offer types…</p> : error || mismatch ? <p role="alert">{error ?? "These figures don't add up; please refresh or report this."} <button onClick={onRetry}>Retry</button></p> : !active ? <p>Select a company and placement cycle.</p> : !total ? <p>No offers recorded.</p> :
      <><p>{total} final offers</p><ul>{types.map(type => <li key={type.key}>{type.label}: {type.count} ({(type.count / total * 100).toFixed(1)}%)</li>)}</ul></>}
  </section>;
}
