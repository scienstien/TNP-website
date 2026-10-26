"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IMPORT_KINDS, TEMPLATES, TEMPLATE_VERSION, type ImportKind } from "@/lib/import/templates";
import type { ImportPreview } from "@/lib/import/process";
import styles from "./ImportManager.module.css";

type History = { id: string; dataset: string; createdAt: string; inserted: number; updated: number; skipped: number; actor: string; fileSha256: string };
export default function ImportManager({ department, history }: { department: string | null; history: History[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<ImportKind>("companies");
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const reset = () => { setReport(null); setError(null); setPage(0); };
  async function submit(mode: "preview" | "confirm") {
    if (!file || busy) return;
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.set("kind", kind); form.set("mode", mode); form.set("file", file);
      if (mode === "confirm" && report?.previewToken && report.planHash) {
        form.set("previewToken", report.previewToken); form.set("planHash", report.planHash);
      }
      const response = await fetch("/api/import", { method: "POST", body: form });
      const data = await response.json();
      if (data.error) { setError(data.error); setReport(null); }
      else { setReport(data); setPage(0); if (data.committed) router.refresh(); }
    } catch { setError("The upload response could not be received. Validate again to check which records already exist before retrying."); setReport(null); }
    finally { setBusy(false); }
  }
  return <main className={`panel ${styles.manager}`}>
    <h1>Admin Data Management</h1>
    <p>Import official data for <strong>{department ?? "a selected department"}</strong>. Every file is reviewed before confirmation. Existing historical records remain in place.</p>
    {!department && <p role="alert">Choose one department in the top navigation to import.</p>}
    <nav className={styles.links} aria-label="Import help">
      <a href="/docs/import-templates">Template preparation guide</a>
      {department && <a href="/api/import/references">Download current reference values (Excel)</a>}
    </nav>
    <h2>1. Prepare your files</h2>
    <p>Use version {TEMPLATE_VERSION} templates in the order below. CSV downloads contain only headers; Excel downloads include instructions and fictional examples on separate sheets.</p>
    <div className={styles.scroll}><table><thead><tr><th>Order</th><th>Dataset</th><th>Required fields</th><th>Download</th></tr></thead><tbody>
      {IMPORT_KINDS.map(item => <tr key={item}><td>{TEMPLATES[item].order}</td><td>{TEMPLATES[item].title}</td><td>{TEMPLATES[item].required.join(", ")}</td><td className={styles.downloads}>
        <a href={`/api/import/templates/${item}`}>CSV template</a>
        <a href={`/api/import/templates/${item}?format=xlsx`}>Excel template</a>
      </td></tr>)}
    </tbody></table></div>
    <h2>2. Validate and review</h2>
    <div className={styles.controls}>
      <label htmlFor="import-kind">Dataset
        <select id="import-kind" value={kind} disabled={busy} onChange={event => { setKind(event.target.value as ImportKind); reset(); setFile(null); }}>
          {IMPORT_KINDS.map(item => <option key={item} value={item}>{TEMPLATES[item].title}</option>)}
        </select>
      </label>
      <label htmlFor="import-file">CSV or Excel file
        <input id="import-file" type="file" disabled={busy} accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" key={kind} onChange={event => { setFile(event.target.files?.[0] ?? null); reset(); }} />
      </label>
      <button type="button" disabled={!department || !file || busy} onClick={() => submit("preview")}>Validate and preview</button>
    </div>
    <p>{TEMPLATES[kind].description}</p>
    <p>Maximum 2 MB and 5,000 data rows. Keep exact headers and column order. Blank optional cells mean NULL. Companies and placement cycles are shared institute-wide.</p>
    {busy && <p role="status">Validating and checking database records…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {report && <section aria-label="Validation report" aria-live="polite" className={styles.report}>
      <h2>{report.committed ? "Import complete" : "Validation report"}</h2>
      <p>{report.inserted} inserts, {report.updated} updates, {report.skipped} skipped, {report.errors.length} errors. {report.committed ? "Saved. Student Records, dashboards and comparisons now use these records." : "No changes saved yet."}</p>
      <p>Counts describe source rows. A student row may create a person, enrollment and cycle registration together.</p>
      {report.errors.length > 0 && <ul role="alert" className={`${styles.error} ${styles.errorList}`}>{report.errors.map((item, i) => <li key={i}>{item}</li>)}</ul>}
      <div className={styles.scroll}><table><thead><tr><th>Line</th><th>Key</th><th>Action</th><th>Detail and values</th></tr></thead><tbody>
        {report.rows.slice(page * 100, (page + 1) * 100).map((row, i) => <tr key={i}><td>{row.line}</td><td>{row.key}</td><td>{row.action}</td><td>
          {row.message}
          <details><summary>Review normalized values{row.before ? " and previous values" : ""}</summary>
            <dl className={styles.values}>{TEMPLATES[kind].columns.map(column => <div key={column}>
              <dt>{column}</dt><dd>{row.values[column] || "NULL (blank)"}{row.before && Object.hasOwn(row.before, column) && <span> — previously: {row.before[column] === null ? "NULL" : String(row.before[column])}</span>}</dd>
            </div>)}</dl>
          </details>
        </td></tr>)}
      </tbody></table></div>
      {report.rows.length > 100 && <div className={styles.links}>
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous rows</button>
        <span>Rows {page * 100 + 1}–{Math.min((page + 1) * 100, report.rows.length)} of {report.rows.length}</span>
        <button disabled={(page + 1) * 100 >= report.rows.length} onClick={() => setPage(page + 1)}>Next rows</button>
      </div>}
      {!report.committed && !report.errors.length && report.previewToken && <div className={styles.confirm}>
        <p>Review every insert, update and skipped record above. Confirmation saves the entire file in one transaction. A changed file or database plan requires a new preview.</p>
        <button type="button" disabled={busy || !department} onClick={() => submit("confirm")}>Confirm import</button>
      </div>}
    </section>}
    <h2>Recent imports</h2>
    {history.length ? <div className={styles.scroll}><table><thead><tr><th>Time</th><th>Administrator</th><th>Dataset</th><th>Inserted</th><th>Updated</th><th>Skipped</th><th>File fingerprint</th></tr></thead><tbody>
      {history.map(item => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.actor}</td><td>{item.dataset}</td><td>{item.inserted}</td><td>{item.updated}</td><td>{item.skipped}</td><td><code title={item.fileSha256}>{item.fileSha256.slice(0, 12)}…</code></td></tr>)}
    </tbody></table></div> : <p>No imports recorded for this department.</p>}
  </main>;
}
