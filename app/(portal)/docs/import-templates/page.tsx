import { Suspense } from "react";
import { requireRole } from "@/lib/auth/dal";
import { IMPORT_KINDS, PREPARATION_RULES, TEMPLATES, TEMPLATE_VERSION } from "@/lib/import/templates";
import styles from "@/components/import/ImportManager.module.css";

async function Guide() {
  await requireRole("ADMIN");
  return <main className={`panel ${styles.manager}`}>
    <h1>Official CSV and Excel preparation guide</h1>
    <p>Template version {TEMPLATE_VERSION}. Download files from <a href="/admin/data-management">Admin Data Management</a> and use the <a href="/api/import/references">current reference workbook</a> for exact codes and IDs.</p>
    <ul>{PREPARATION_RULES.map(rule => <li key={rule}>{rule}</li>)}</ul>
    {IMPORT_KINDS.map(kind => <section key={kind}>
      <h2>{TEMPLATES[kind].order}. {TEMPLATES[kind].title}</h2>
      <p>{TEMPLATES[kind].description}</p>
      <p><strong>Worksheet:</strong> <code>{kind}</code>. <strong>Match key:</strong> {TEMPLATES[kind].key}.</p>
      <p><strong>Exact CSV header:</strong> <code style={{ overflowWrap: "anywhere" }}>{TEMPLATES[kind].columns.join(",")}</code></p>
      <div className={styles.scroll}><table><thead><tr><th>Column (exact order)</th><th>Required</th><th>Type</th><th>Accepted values / relationships</th></tr></thead><tbody>
        {TEMPLATES[kind].fields.map(field => <tr key={field.name}><td><code>{field.name}</code></td><td>{field.required ? "Yes" : "No / conditional"}</td><td>{field.type}</td><td>{field.rule}</td></tr>)}
      </tbody></table></div>
      <p><a href={`/api/import/templates/${kind}`}>Download CSV</a>{" · "}<a href={`/api/import/templates/${kind}?format=xlsx`}>Download Excel with instructions</a></p>
    </section>)}
    <h2>Official source preparation and reconciliation</h2>
    <p>Confirm programme names, cohort years, registration, globally unique rolls and company names with the T&amp;P Cell before importing. If a required classification is absent, resolve it with the source owner. Leave unknown optional values blank. Admission year must not follow graduation year.</p>
    <p>Different rolls are treated as separate people. If the institute confirms that UG and PG enrollments belong to one person, use a separately reviewed identity-linking process. Importing names never establishes that relationship.</p>
    <p>Drives, roles and process events are maintained through the existing company and calendar editors. Historical offers may omit drive and role; use existing exact IDs when known. Reference catalogues and login accounts are not imported by this workflow.</p>
    <p>Fix every reported error before confirming. Review normalized values, previous values and insert/update/skip counts against the official source. Confirmation records the actor, selected department, dataset, file SHA-256 and counts atomically with the data. Source rows are not archived in import history.</p>
    <p>Reload Student Records or the dashboard and select the explicit imported cycle and degree level. UNREGISTERED students are excluded from registered-student placement metrics. Keep approved source files securely for reconciliation.</p>
  </main>;
}
export default function ImportGuide() {
  return <Suspense fallback={<p role="status">Loading preparation guide…</p>}><Guide /></Suspense>;
}
