"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStudent, patchStudent, deleteStudent, removeStudentOffer, createStudentCompany } from "@/lib/students/actions";
import { validateCompany } from "@/lib/students/company-validation";
import { validateStudent } from "@/lib/students/validation";
import { OFFER_TYPES } from "@/lib/placements/types";
import type { StudentData, StudentRecord, StudentResult } from "@/lib/students/types";
import "./students.css";

export default function StudentRecords({ data }: { data: StudentData }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [editing, setEditing] = useState<StudentRecord | "new" | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const visible = data.students.filter(s =>
    `${s.rollNumber} ${s.name} ${s.batchYear} ${s.offer?.companyName ?? ""}`.toLowerCase().includes(query.toLowerCase()) &&
    (filter === "All" || (filter === "Unplaced" ? !s.offer :
      filter === "Placed" ? !!s.offer : s.offer?.offerType === filter)));
  function remove(student: StudentRecord, offer: boolean) {
    if (!window.confirm(offer
      ? `Remove the offer for ${student.name}? The student will become unplaced.`
      : `Delete ${student.name} (${student.rollNumber})? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        const result = await (offer ? removeStudentOffer : deleteStudent)(student.rollNumber, JSON.stringify(student));
        setMessage(result.ok ? "Record updated." : result.error ?? "Unable to remove record.");
        if (result.ok) router.refresh();
      } catch { setMessage("Unable to save. Check your connection and retry."); }
    });
  }
  return (
    <section className="student-records">
      <div className="section-heading">
        <div><p className="eyebrow">ADMIN DATA ENTRY</p><h1>Student records</h1>
          <p>Saved students and offers from the database. Save each edit to update dashboard statistics.</p></div>
        <button className="dark-button" disabled={pending || editing !== null}
          onClick={() => { setEditing("new"); setMessage(""); }}>Add student</button>
      </div>
      {message && <p role="status">{message}</p>}
      {editing && <StudentEditor key={editing === "new" ? "new" : editing.rollNumber}
        initial={editing === "new" ? null : editing} companies={data.companies}
        onCancel={() => { setEditing(null); router.refresh(); }}
        onSaved={() => { setEditing(null); setMessage("Saved to the database."); }} />}
      <section className="panel table-panel">
        <div className="table-tools">
          <label>Search <input value={query} placeholder="Name, roll, batch or company"
            onChange={e => setQuery(e.target.value)} /></label>
          <label>Filter <select value={filter} onChange={e => setFilter(e.target.value)}>
            {["All", "Placed", "Unplaced", ...OFFER_TYPES].map(f => <option key={f}>{f}</option>)}
          </select></label>
        </div>
        {!visible.length && <p className="table-hint" role="status">{data.students.length
          ? "No students match the current filters." : "No student records loaded."}</p>}
        <div className="student-table-scroll">
          <table className="student-db-table">
            <thead><tr>{["Roll number", "Name", "Batch", "Status", "Company", "Sector", "Job role", "Offer type", "CTC (LPA)", "Offer date", "Actions"]
              .map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{visible.map(s => <tr key={s.rollNumber}>
              <td>{s.rollNumber}</td><td>{s.name}</td><td>{s.batchYear}</td>
              <td>{s.offer ? "Placed" : "Unplaced"}</td>
              <td>{s.offer?.companyName ?? "—"}</td>
              <td>{data.companies.find(c => c.name === s.offer?.companyName)?.domain ?? "—"}</td>
              <td>{s.offer?.jobRole ?? "—"}</td><td>{s.offer?.offerType ?? "—"}</td>
              <td>{s.offer?.packageLpa ?? "—"}</td><td>{s.offer?.offerDate ?? "—"}</td>
              <td><div className="student-row-actions">
                <button disabled={pending || editing !== null} onClick={() => { setEditing(s); setMessage(""); }}>Edit</button>
                {s.offer && <button disabled={pending || editing !== null} onClick={() => remove(s, true)}>Remove offer</button>}
                <button disabled={pending || editing !== null || !!s.offer}
                  title={s.offer ? "Remove the offer before deleting this student." : undefined}
                  onClick={() => remove(s, false)}>Delete student</button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function StudentEditor({ initial, companies, onCancel, onSaved }: {
  initial: StudentRecord | null;
  companies: StudentData["companies"];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const baseline = {
    rollNumber: initial ? String(initial.rollNumber) : "", name: initial?.name ?? "",
    batchYear: initial ? String(initial.batchYear) : "",
    companyName: initial?.offer?.companyName ?? "", jobRole: initial?.offer?.jobRole ?? "",
    packageLpa: initial?.offer?.packageLpa ?? "", offerType: initial?.offer?.offerType ?? "",
    offerDate: initial?.offer?.offerDate ?? "",
  };
  const [draft, setDraft] = useState(baseline);
  const [hasOffer, setHasOffer] = useState(!!initial?.offer);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [companyDraft, setCompanyDraft] = useState({ name: "", domain: "" });
  const [companyResult, setCompanyResult] = useState<StudentResult>({});
  const [createdCompanies, setCreatedCompanies] = useState<StudentData["companies"]>([]);
  const companyOptions = [...companies, ...createdCompanies.filter(created =>
    !companies.some(company => company.name === created.name))]
    .sort((a, b) => a.name.localeCompare(b.name));
  const [result, setResult] = useState<StudentResult>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  type Field = keyof typeof baseline;
  function payload() {
    const offer = { companyName: draft.companyName, jobRole: draft.jobRole,
      packageLpa: draft.packageLpa, offerType: draft.offerType, offerDate: draft.offerDate };
    return { rollNumber: draft.rollNumber, name: draft.name, batchYear: draft.batchYear,
      ...(hasOffer ? { offer } : {}) };
  }
  function field(key: Field, label: string, extra: { readOnly?: boolean; inputMode?: "numeric" | "decimal"; type?: string; maxLength?: number } = {}) {
    return <div className="student-field" key={key}>
      <label htmlFor={`student-${key}`}>{label}</label>
      <input id={`student-${key}`} value={draft[key]} {...extra} disabled={pending}
        onChange={e => { setDraft(d => ({ ...d, [key]: e.target.value })); setResult({}); }}
        onBlur={() => {
          const { fieldErrors } = validateStudent(payload(), true);
          setResult(r => ({ ...r, fieldErrors: { ...r.fieldErrors, [key]: fieldErrors[key] ?? "" } }));
        }}
        aria-invalid={!!result.fieldErrors?.[key]} aria-describedby={`student-error-${key}`} />
      <span className="student-field-error" id={`student-error-${key}`}>{result.fieldErrors?.[key]}</span>
    </div>;
  }
  return <form className="panel student-editor" noValidate onSubmit={e => {
    e.preventDefault();
    if (creatingCompany || pending) return;
    const complete = payload();
    const validated = validateStudent(complete, true);
    if (Object.keys(validated.fieldErrors).length) { setResult({ fieldErrors: validated.fieldErrors }); return; }
    const changes: Record<string, unknown> = {};
    for (const key of ["name", "batchYear"] as const) if (draft[key] !== baseline[key]) changes[key] = draft[key];
    if (hasOffer) {
      const offer: Record<string, unknown> = {};
      for (const key of ["companyName", "jobRole", "packageLpa", "offerType", "offerDate"] as const) {
        if (!initial?.offer || draft[key] !== baseline[key]) offer[key] = draft[key];
      }
      if (Object.keys(offer).length) changes.offer = offer;
    }
    startTransition(async () => {
      try {
        const saved = initial ? await patchStudent(initial.rollNumber, changes, JSON.stringify(initial)) : await createStudent(complete);
        setResult(saved);
        if (saved.ok) { router.refresh(); onSaved(); }
      } catch { setResult({ error: "Unable to save. Your draft is preserved; try again." }); }
    });
  }}>
    <h2>{initial ? `Edit ${initial.rollNumber}` : "Add student — unsaved draft"}</h2>
    <div className="student-fields">
      {field("rollNumber", "Roll number (9 digits)", { inputMode: "numeric", readOnly: !!initial })}
      {field("name", "Student name")}
      {field("batchYear", "Graduating batch", { inputMode: "numeric" })}
    </div>
    {!initial?.offer && <label className="student-offer-toggle"><input type="checkbox" checked={hasOffer} disabled={pending}
      onChange={e => { setHasOffer(e.target.checked); if (!e.target.checked) setCreatingCompany(false); }} /> Add an offer</label>}
    {hasOffer && <div className="student-fields">
      <div className="student-field">
        <label htmlFor="student-companyName">Company</label>
        <select id="student-companyName" value={draft.companyName} disabled={pending} aria-invalid={!!result.fieldErrors?.companyName}
          aria-describedby="student-error-companyName"
          onChange={e => { setDraft(d => ({ ...d, companyName: e.target.value })); setResult({}); }}>
          <option value="">Select an existing company</option>
          {companyOptions.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        <span className="student-field-error" id="student-error-companyName">{result.fieldErrors?.companyName}</span>
        {!companyOptions.length && <small>No companies yet. Create one below to assign this offer.</small>}
        {!creatingCompany && <button type="button" disabled={pending} onClick={() => {
          setCreatingCompany(true); setCompanyResult({});
        }}>Create new company</button>}
        {creatingCompany && <fieldset disabled={pending} className="student-company-create">
          <legend>Create new company</legend>
          <p>The company is saved separately. Your student is saved when you click Save.</p>
          <label htmlFor="new-company-name">Company name</label>
          <input id="new-company-name" value={companyDraft.name}
            aria-invalid={!!companyResult.fieldErrors?.name} aria-describedby="new-company-name-error"
            onChange={e => { setCompanyDraft(d => ({ ...d, name: e.target.value })); setCompanyResult({}); }} />
          <span id="new-company-name-error" className="student-field-error">{companyResult.fieldErrors?.name}</span>
          <label htmlFor="new-company-sector">Company sector (optional)</label>
          <input id="new-company-sector" value={companyDraft.domain}
            aria-invalid={!!companyResult.fieldErrors?.domain} aria-describedby="new-company-sector-error"
            onChange={e => { setCompanyDraft(d => ({ ...d, domain: e.target.value })); setCompanyResult({}); }} />
          <span id="new-company-sector-error" className="student-field-error">{companyResult.fieldErrors?.domain}</span>
          {(companyResult.error || companyResult.fieldErrors?.form) &&
            <p role="alert">{companyResult.error || companyResult.fieldErrors?.form}</p>}
          <div className="student-row-actions">
            <button type="button" onClick={() => {
              const { fieldErrors } = validateCompany(companyDraft);
              if (Object.keys(fieldErrors).length) { setCompanyResult({ fieldErrors }); return; }
              startTransition(async () => {
                try {
                  const saved = await createStudentCompany(companyDraft);
                  setCompanyResult(saved);
                  if (saved.ok && saved.company) {
                    const company = saved.company;
                    setCreatedCompanies(current => [...current, company]);
                    setDraft(current => ({ ...current, companyName: company.name }));
                    setResult({});
                    setCreatingCompany(false);
                    setCompanyDraft({ name: "", domain: "" });
                    router.refresh();
                  }
                } catch { setCompanyResult({ error: "Unable to create company. Please retry." }); }
              });
            }}>{pending ? "Creating…" : "Create and select"}</button>
            <button type="button" onClick={() => setCreatingCompany(false)}>Cancel company</button>
          </div>
        </fieldset>}
      </div>
      <label className="student-field">Sector<input readOnly value={companyOptions.find(c => c.name === draft.companyName)?.domain ?? ""} /></label>
      {field("jobRole", "Job role (optional)")}
      {field("packageLpa", "Package in LPA (optional)", { inputMode: "decimal" })}
      <label className="student-field">Offer type (optional)
        <select value={draft.offerType} disabled={pending} onChange={e => setDraft(d => ({ ...d, offerType: e.target.value }))}>
          <option value="">Not recorded</option>{OFFER_TYPES.map(t => <option key={t}>{t}</option>)}
        </select><span className="student-field-error">{result.fieldErrors?.offerType}</span>
      </label>
      {field("offerDate", "Offer date (optional)", { type: "date" })}
    </div>}
    {(result.error || result.fieldErrors?.form || result.fieldErrors?.offer) &&
      <p role="alert">{result.error || result.fieldErrors?.form || result.fieldErrors?.offer}</p>}
    <div className="student-row-actions">
      <button type="submit" className="dark-button" disabled={pending || creatingCompany}>{pending ? "Saving…" : "Save"}</button>
      <button type="button" disabled={pending} onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}
