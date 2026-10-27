import { Suspense } from "react";
import { requireRole } from "@/lib/auth/dal";
import { IMPORT_KINDS, PREPARATION_RULES, TEMPLATES, TEMPLATE_VERSION } from "@/lib/import/templates";
import styles from "@/components/import/ImportManager.module.css";

async function Guide() {
  await requireRole("ADMIN");
  return <main className={`panel ${styles.manager}`}>
    <h1>Import guide</h1>
    <p>Templates v{TEMPLATE_VERSION}: <a href="/admin/data-management">Import data</a> · <a href="/api/import/references">Reference values</a>.</p>
    <ul>{PREPARATION_RULES.map(rule => <li key={rule}>{rule}</li>)}</ul>
    {IMPORT_KINDS.map(kind => <section key={kind}>
      <h2>{TEMPLATES[kind].order}. {TEMPLATES[kind].title}</h2>
      <p>{TEMPLATES[kind].description}</p>
      <p><strong>Worksheet:</strong> <code>{kind}</code>. <strong>Match key:</strong> {TEMPLATES[kind].key}.</p>
      <p><strong>Exact CSV header:</strong> <code style={{ overflowWrap: "anywhere" }}>{TEMPLATES[kind].columns.join(",")}</code></p>
      <div className={styles.scroll}><table><thead><tr><th>Column (exact order)</th><th>Required</th><th>Type</th><th>Accepted values / relationships</th></tr></thead><tbody>
        {TEMPLATES[kind].fields.map(field => <tr key={field.name}><td><code>{field.name}</code></td><td>{field.required ? "Yes" : "No / conditional"}</td><td>{field.type}</td><td>{field.rule}</td></tr>)}
      </tbody></table></div>
      <p><a href={`/api/import/templates/${kind}`}>CSV</a>{" · "}<a href={`/api/import/templates/${kind}?format=xlsx`}>Excel with instructions</a></p>
    </section>)}
    <h2>Before confirming</h2>
    <p>Verify programmes, cohorts, registration, unique rolls and company names with the T&amp;P Cell. Resolve missing required values; leave unknown optional values blank. Admission year cannot follow graduation year.</p>
    <p>Different rolls create separate people. Linking UG and PG enrollments needs separate review; matching names are insufficient.</p>
    <p>Manage drives, roles and stages in Companies and Calendar. Historical offers may omit drive and role. This import excludes reference catalogues and login accounts.</p>
    <p>Resolve errors and reconcile changes against the source. Confirmation records the actor, department, dataset, file hash and counts; source rows are not archived.</p>
    <p>Reload records after import. UNREGISTERED students are excluded from placement metrics. Keep source files securely.</p>
  </main>;
}
export default function ImportGuide() {
  return <Suspense fallback={<p role="status">Loading preparation guide…</p>}><Guide /></Suspense>;
}
