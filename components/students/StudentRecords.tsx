"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  ChevronDown,
  CircleSlash2,
  Pencil,
  Search,
  Trash2,
  UsersRound,
} from "lucide-react";
import { createStudent, patchStudent, deleteStudent, removeStudentOffer, createStudentCompany } from "@/lib/students/actions";
import { validateCompany } from "@/lib/students/company-validation";
import { validateStudent } from "@/lib/students/validation";
import { OFFER_TYPES } from "@/lib/placements/types";
import type { StudentData, StudentRecord, StudentResult } from "@/lib/students/types";
import { DatePicker } from "@/components/ui/date-picker";
import "./students.css";

export default function StudentRecords({ data }: { data: StudentData }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [batchFilter, setBatchFilter] = useState("All");
  const [companyFilter, setCompanyFilter] = useState("All");
  const [editing, setEditing] = useState<StudentRecord | "new" | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const batches = [...new Set(data.students.map(s => s.batchYear))]
    .sort((a, b) => b - a);
  const companies = [...new Set(data.students.flatMap(s => s.offer ? [s.offer.companyName] : []))]
    .sort((a, b) => a.localeCompare(b));
  const placedCount = data.students.filter((student) => student.offer).length;
  const unplacedCount = data.students.length - placedCount;
  const visible = data.students.filter(s =>
    `${s.rollNumber} ${s.name} ${s.batchYear} ${s.offer?.companyName ?? ""}`.toLowerCase().includes(query.toLowerCase()) &&
    (batchFilter === "All" || s.batchYear === Number(batchFilter)) &&
    (companyFilter === "All" || s.offer?.companyName === companyFilter) &&
    (statusFilter === "All" || (statusFilter === "Unplaced" ? !s.offer :
      statusFilter === "Placed" ? !!s.offer : s.offer?.offerType === statusFilter)));
  const clearFilters = () => {
    setQuery("");
    setBatchFilter("All");
    setCompanyFilter("All");
    setStatusFilter("All");
  };
  const activeFilters = [
    query && { label: `Search: ${query}`, clear: () => setQuery("") },
    batchFilter !== "All" && { label: `Batch: ${batchFilter}`, clear: () => setBatchFilter("All") },
    companyFilter !== "All" && { label: `Company: ${companyFilter}`, clear: () => setCompanyFilter("All") },
    statusFilter !== "All" && { label: `Status: ${statusFilter}`, clear: () => setStatusFilter("All") },
  ].filter(Boolean) as { label: string; clear: () => void }[];
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
        <div><p className="student-breadcrumb">Dashboard / Student records</p><h1>Student records</h1>
          <p>Saved students and offers from the database. Save each edit to update dashboard statistics.</p></div>
        <button className="dark-button" disabled={pending || editing !== null}
          onClick={() => { setEditing("new"); setMessage(""); }}>Add student</button>
      </div>
      {message && <p role="status">{message}</p>}
      {editing && <StudentEditorModal onClose={() => { setEditing(null); router.refresh(); }}>
        <StudentEditor key={editing === "new" ? "new" : editing.rollNumber}
          initial={editing === "new" ? null : editing} companies={data.companies}
          currentBatchYear={data.currentBatchYear}
          onCancel={() => { setEditing(null); router.refresh(); }}
          onSaved={() => { setEditing(null); setMessage("Saved to the database."); }} />
      </StudentEditorModal>}
      <section className="panel table-panel student-table-card">
        <div className="student-table-card-header">
          <div>
            <p className="student-table-kicker">PLACEMENT ROSTER</p>
            <h2>Student directory</h2>
            <p>Search, filter, and update each student&apos;s recorded offer.</p>
          </div>
          <div className="student-table-stats" aria-label="Student record summary">
            <Stat label="Recorded" value={data.students.length} icon={UsersRound} />
            <Stat label="Placed" value={placedCount} icon={BriefcaseBusiness} tone="placed" />
            <Stat label="Unplaced" value={unplacedCount} icon={CircleSlash2} tone="unplaced" />
          </div>
        </div>
        <div className="student-toolbar">
          <div className="student-toolbar-controls">
            <label className="student-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Search students</span>
              <input value={query} placeholder="Search name, roll number or company"
                onChange={e => setQuery(e.target.value)} />
            </label>
            <FilterSelect label="Batch" value={batchFilter} onChange={setBatchFilter}>
              <option value="All">All batches</option>
              {batches.map(batch => <option key={batch} value={batch}>{batch}</option>)}
            </FilterSelect>
            <FilterSelect label="Company" value={companyFilter} onChange={setCompanyFilter}>
              <option value="All">All companies</option>
              {companies.map(company => <option key={company} value={company}>{company}</option>)}
            </FilterSelect>
            <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter}>
              {["All", "Placed", "Unplaced", ...OFFER_TYPES].map(status => <option key={status}>{status}</option>)}
            </FilterSelect>
          </div>
          <div className="student-toolbar-summary">
            <div className="student-active-filters" aria-label="Active filters">
              {activeFilters.map(filter => <button key={filter.label} type="button" className="student-filter-chip" onClick={filter.clear}>
                {filter.label} <span aria-hidden="true">×</span>
              </button>)}
              {activeFilters.length > 0 && <button type="button" className="student-clear-filters" onClick={clearFilters}>Clear all</button>}
            </div>
            <span className="student-result-count" role="status">
              {visible.length ? `Showing 1–${visible.length} of ${data.students.length}` : `Showing 0 of ${data.students.length}`}
            </span>
          </div>
        </div>
        {!visible.length && <p className="table-hint" role="status">{data.students.length
          ? "No students match the current filters." : "No student records loaded."}</p>}
        <div className="student-table-scroll">
          <table className="student-db-table">
            <thead><tr>{["Roll number", "Name", "Batch", "Status", "Company", "Sector", "Job role", "Offer type", "CTC (LPA)", "Offer date", "Actions"]
              .map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{visible.map(s => <tr key={s.rollNumber}>
              <td>{s.rollNumber}</td><td>{s.name}</td><td>{s.batchYear}</td>
              <td><span className={`student-status student-status--${s.offer ? "placed" : "unplaced"}`}>
                {s.offer ? "Placed" : "Unplaced"}
              </span></td>
              <td>{s.offer?.companyName ?? "—"}</td>
              <td>{data.companies.find(c => c.name === s.offer?.companyName)?.domain ?? "—"}</td>
              <td>{s.offer?.jobRole ?? "—"}</td><td>{s.offer?.offerType ?? "—"}</td>
              <td>{s.offer?.packageLpa ?? "—"}</td><td>{s.offer?.offerDate ?? "—"}</td>
              <td><div className="student-row-actions">
                <button className="student-icon-button" type="button" title={`Edit ${s.name}`} aria-label={`Edit ${s.name}`}
                  disabled={pending || editing !== null} onClick={() => { setEditing(s); setMessage(""); }}><Pencil size={15} /></button>
                {s.offer && <button className="student-icon-button student-icon-button--warning" type="button" title={`Remove ${s.name}'s offer`} aria-label={`Remove ${s.name}'s offer`}
                  disabled={pending || editing !== null} onClick={() => remove(s, true)}><BriefcaseBusiness size={15} /></button>}
                <button className="student-icon-button student-icon-button--danger" type="button" title={s.offer ? "Remove the offer before deleting this student." : `Delete ${s.name}`}
                  aria-label={`Delete ${s.name}`} disabled={pending || editing !== null || !!s.offer}
                  onClick={() => remove(s, false)}><Trash2 size={15} /></button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof UsersRound;
  label: string;
  tone?: "placed" | "unplaced";
  value: number;
}) {
  return <div className={`student-stat${tone ? ` student-stat--${tone}` : ""}`}>
    <Icon size={15} aria-hidden="true" />
    <span><strong>{value}</strong>{label}</span>
  </div>;
}

function FilterSelect({ label, value, onChange, children }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return <label className="student-filter-select">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    <ChevronDown size={15} aria-hidden="true" />
  </label>;
}

function StudentEditorModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return <div className="student-modal-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="student-modal" role="dialog" aria-modal="true" aria-labelledby="student-editor-title">
      {children}
    </section>
  </div>;
}

function StudentEditor({ initial, companies, currentBatchYear, onCancel, onSaved }: {
  initial: StudentRecord | null;
  companies: StudentData["companies"];
  currentBatchYear: number;
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
  function field(key: Field, label: string, extra: { readOnly?: boolean; inputMode?: "numeric" | "decimal"; type?: string; maxLength?: number; min?: string } = {}) {
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
    <div className="student-editor-heading">
      <h2 id="student-editor-title">{initial ? `Edit ${initial.rollNumber}` : "Add student — unsaved draft"}</h2>
      <button type="button" className="student-editor-close" onClick={onCancel} disabled={pending} aria-label="Close editor">×</button>
    </div>
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
      <div className="student-field">
        <label htmlFor="student-offerDate">Offer date (optional)</label>
        <DatePicker id="student-offerDate" value={draft.offerDate} disabled={pending}
          min={Number(draft.batchYear) === currentBatchYear
            ? companyOptions.find(c => c.name === draft.companyName)?.visitDate ?? undefined
            : undefined}
          onChange={(value) => { setDraft((current) => ({ ...current, offerDate: value })); setResult({}); }} />
        <span className="student-field-error">{result.fieldErrors?.offerDate}</span>
      </div>
    </div>}
    {(result.error || result.fieldErrors?.form || result.fieldErrors?.offer) &&
      <p role="alert">{result.error || result.fieldErrors?.form || result.fieldErrors?.offer}</p>}
    <div className="student-row-actions">
      <button type="submit" className="dark-button" disabled={pending || creatingCompany}>{pending ? "Saving…" : "Save"}</button>
      <button type="button" disabled={pending} onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}
