"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  ChevronDown,
  CircleSlash2,
  ClipboardList,
  Pencil,
  Search,
  Trash2,
  UsersRound,
} from "lucide-react";
import {
  createStudent,
  createStudentCompany,
  deleteStudent,
  patchStudent,
  removeStudentOffer,
  removeStudentParticipation,
  setStudentParticipation,
} from "@/lib/students/actions";
import { validateCompany } from "@/lib/students/company-validation";
import { EMPTY_STUDENT_FILTERS, studentListQuery, STUDENT_STATUSES, type StudentListFilters, type StudentStatusFilter } from "@/lib/students/list-params";
import { validateParticipation, validateStudent } from "@/lib/students/validation";
import { OFFER_TYPES, REGISTRATION_STATUSES } from "@/lib/placements/types";
import type { CompanyOption, StudentData, StudentRecord, StudentResult } from "@/lib/students/types";
import { DatePicker } from "@/components/ui/date-picker";
import "./students.css";

type Options = Omit<StudentData, "students" | "list" | "readOnly">;
type Status = "Placed" | "Unplaced" | "Not registered";

/** Derived, never stored: an offer means placed; REGISTERED without an offer means unplaced. */
const statusOf = (student: StudentRecord): Status =>
  student.offer ? "Placed"
    : student.participations.some((item) => item.registrationStatus === "REGISTERED") ? "Unplaced" : "Not registered";
const statusClass: Record<Status, string> = { Placed: "placed", Unplaced: "unplaced", "Not registered": "unregistered" };

/** Outcome text for the records list; failures are announced as alerts. */
type Feedback = { text: string; alert: boolean };

/** Why Delete is unavailable, shown beside the action rather than only as a tooltip. The server enforces it too. */
export const deleteBlockedReason = (student: StudentRecord) =>
  student.offer ? "Remove the offer before deleting this student." : null;

export function removalConfirmation(student: StudentRecord, offer: boolean) {
  return offer
    ? `Remove the offer for ${student.name}? The student will become unplaced.`
    : `Delete ${student.name} (${student.rollNumber})? This removes this enrollment and its placement-cycle registrations. ` +
      "The person record is kept if they have another enrollment. This cannot be undone.";
}

/** Sends one confirmed removal. A rejection keeps the record and shows the server's exact message as an alert. */
export async function sendRemoval(student: StudentRecord, send: (roll: number, expected: string) => Promise<StudentResult>) {
  try {
    const result = await send(student.rollNumber, JSON.stringify(student));
    const feedback: Feedback = result.ok ? { text: "Record updated.", alert: false }
      : { text: result.error ?? Object.values(result.fieldErrors ?? {})[0] ?? "Unable to remove record.", alert: true };
    return { feedback, refresh: !!result.ok };
  } catch {
    return { feedback: { text: "Unable to save. Check your connection and retry.", alert: true }, refresh: false };
  }
}

export default function StudentRecords({ data }: { data: StudentData }) {
  const { students, readOnly = false, list, ...options } = data;
  const { filters } = list;
  const [editing, setEditing] = useState<StudentRecord | "new" | null>(null);
  const [registrationsRoll, setRegistrationsRoll] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [searchText, setSearchText] = useState(filters.q);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(searchTimer.current), []);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const busy = pending || editing !== null || registrationsRoll !== null;
  /** Search, filters and paging run on the server: each change loads the matching page (page 1 unless the page itself changes). */
  const go = (change: Partial<StudentListFilters>) =>
    startTransition(() => router.replace(`/students${studentListQuery({ ...filters, page: 1, ...change })}`));
  const search = (text: string) => {
    setSearchText(text);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => go({ q: text.trim() }), 300);
  };
  const clearFilters = () => {
    clearTimeout(searchTimer.current);
    setSearchText("");
    go({ ...EMPTY_STUDENT_FILTERS });
  };
  const pages = Math.max(1, Math.ceil(list.matching / list.pageSize));
  const firstShown = students.length ? (list.page - 1) * list.pageSize + 1 : 0;
  const activeFilters = [
    filters.q && { label: `Search: ${filters.q}`, clear: () => { setSearchText(""); go({ q: "" }); } },
    filters.department && { label: `Department: ${filters.department.toUpperCase()}`, clear: () => go({ department: null }) },
    filters.batch !== null && { label: `Batch: ${filters.batch}`, clear: () => go({ batch: null }) },
    filters.company && { label: `Company: ${filters.company}`, clear: () => go({ company: null }) },
    filters.status && { label: `Status: ${filters.status}`, clear: () => go({ status: null }) },
  ].filter(Boolean) as { label: string; clear: () => void }[];
  function remove(student: StudentRecord, offer: boolean) {
    if (!window.confirm(removalConfirmation(student, offer))) return;
    startTransition(async () => {
      const { feedback, refresh } = await sendRemoval(student, offer ? removeStudentOffer : deleteStudent);
      setFeedback(feedback);
      if (refresh) router.refresh();
    });
  }
  return (
    <section className="student-records">
      <div className="section-heading">
        <div><p className="student-breadcrumb">Dashboard / Student records</p><h1>Student records</h1>
          <p>Saved students, placement-cycle registrations and offers from the database. Save each edit to update dashboard statistics.</p></div>
        {!readOnly && (
        <button className="dark-button" disabled={busy}
          onClick={() => { setEditing("new"); setFeedback(null); }}>Add student</button>)}
      </div>
      {feedback?.alert && <p role="alert">{feedback.text}</p>}
      {feedback && !feedback.alert && <p role="status">{feedback.text}</p>}
      {editing && <StudentEditorModal onClose={() => { setEditing(null); router.refresh(); }}>
        <StudentEditor key={editing === "new" ? "new" : editing.rollNumber}
          initial={editing === "new" ? null : editing} options={options}
          onCancel={() => { setEditing(null); router.refresh(); }}
          onSaved={() => { setEditing(null); setFeedback({ text: "Saved to the database.", alert: false }); }} />
      </StudentEditorModal>}
      {registrationsRoll !== null && <StudentEditorModal labelledBy="student-registrations-title"
        onClose={() => { setRegistrationsRoll(null); router.refresh(); }}>
        <RegistrationEditor student={students.find(s => s.rollNumber === registrationsRoll) ?? null} options={options}
          onClose={() => { setRegistrationsRoll(null); router.refresh(); }} />
      </StudentEditorModal>}
      <section className="panel table-panel student-table-card">
        <div className="student-table-card-header">
          <div>
            <p className="student-table-kicker">PLACEMENT ROSTER</p>
            <h2>Student directory</h2>
            <p>Search, filter, and update each student&apos;s registrations and recorded offer.</p>
          </div>
          <div className="student-table-stats" aria-label="Student record summary">
            <Stat label="Recorded" value={list.recorded} icon={UsersRound} />
            <Stat label="Placed" value={list.placed} icon={BriefcaseBusiness} tone="placed" />
            <Stat label="Unplaced" value={list.unplaced} icon={CircleSlash2} tone="unplaced" />
          </div>
        </div>
        <div className="student-toolbar">
          <div className="student-toolbar-controls">
            <label className="student-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Search students</span>
              <input value={searchText} placeholder="Search name, roll number, cycle or company"
                onChange={e => search(e.target.value)} />
            </label>
            {readOnly && <FilterSelect label="Department" value={filters.department ?? "All"} onChange={value => go({ department: value === "All" ? null : value })}>
              <option value="All">All departments</option>
              {list.departmentCodes.map(code => <option key={code} value={code}>{code.toUpperCase()}</option>)}
            </FilterSelect>}
            <FilterSelect label="Batch" value={filters.batch === null ? "All" : String(filters.batch)} onChange={value => go({ batch: value === "All" ? null : Number(value) })}>
              <option value="All">All batches</option>
              {list.batches.map(batch => <option key={batch} value={batch}>{batch}</option>)}
            </FilterSelect>
            <FilterSelect label="Company" value={filters.company ?? "All"} onChange={value => go({ company: value === "All" ? null : value })}>
              <option value="All">All companies</option>
              {list.companies.map(company => <option key={company} value={company}>{company}</option>)}
            </FilterSelect>
            <FilterSelect label="Status" value={filters.status ?? "All"} onChange={value => go({ status: value === "All" ? null : value as StudentStatusFilter })}>
              {["All", ...STUDENT_STATUSES].map(status => <option key={status}>{status}</option>)}
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
              {students.length ? `Showing ${firstShown}–${firstShown + students.length - 1} of ${list.matching}` : `Showing 0 of ${list.matching}`}
            </span>
          </div>
        </div>
        {!students.length && <p className="table-hint" role="status">{list.recorded
          ? "No students match the current filters." : "No student records loaded."}</p>}
        <div className="student-table-scroll">
          <table className="student-db-table">
            <thead><tr>{[...(readOnly ? ["Department"] : []), "Roll number", "Name", "Programme", "Batch", "Cycles", "Status", "Company", "Sector", "Job role", "Offer type", "CTC (LPA)", "Offer date", ...(readOnly ? [] : ["Actions"])]
              .map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{students.map(s => <tr key={s.rollNumber}>
              {readOnly && <td>{s.departmentCode.toUpperCase()}</td>}
              <td>{s.rollNumber}</td><td>{s.name}</td><td>{s.programmeLabel}</td><td>{s.batchYear}</td>
              <td>{s.participations.length ? <span className="student-cycles">{s.participations.map(p =>
                <span key={p.cycleId} title={p.registrationStatus}
                  className={`student-cycle${p.registrationStatus === "UNREGISTERED" ? " student-cycle--unregistered" : ""}`}>
                  {p.cycleCode}{p.registrationStatus === "UNREGISTERED" ? " · unregistered" : ""}
                </span>)}</span> : "—"}</td>
              <td><span className={`student-status student-status--${statusClass[statusOf(s)]}`}>{statusOf(s)}</span></td>
              <td>{s.offer?.companyName ?? "—"}</td>
              <td>{options.companies.find(c => c.companyId === s.offer?.companyId)?.domain ?? "—"}</td>
              <td>{s.offer?.jobRole ?? "—"}</td><td>{s.offer?.offerType ?? "—"}</td>
              <td>{s.offer?.packageLpa ?? "—"}</td><td>{s.offer?.offerDate ?? "—"}</td>
              {!readOnly && <td><div className="student-row-actions">
                <button className="student-icon-button" type="button" title={`Edit ${s.name}`} aria-label={`Edit ${s.name}`}
                  disabled={busy} onClick={() => { setEditing(s); setFeedback(null); }}><Pencil size={15} /></button>
                <button className="student-icon-button" type="button" title={`${s.name}'s placement-cycle registrations`}
                  aria-label={`Registrations for ${s.name}`} disabled={busy}
                  onClick={() => { setRegistrationsRoll(s.rollNumber); setFeedback(null); }}><ClipboardList size={15} /></button>
                {s.offer && <button className="student-icon-button student-icon-button--warning" type="button" title={`Remove ${s.name}'s offer`} aria-label={`Remove ${s.name}'s offer`}
                  disabled={busy} onClick={() => remove(s, true)}><BriefcaseBusiness size={15} /></button>}
                <DeleteAction student={s} disabled={busy} onDelete={() => remove(s, false)} />
              </div></td>}
            </tr>)}</tbody>
          </table>
        </div>
        {pages > 1 && <nav className="student-pagination" aria-label="Student records pages">
          <button type="button" disabled={list.page <= 1} onClick={() => go({ page: list.page - 1 })}>Previous</button>
          <span>Page {list.page} of {pages}</span>
          <button type="button" disabled={list.page >= pages} onClick={() => go({ page: list.page + 1 })}>Next</button>
        </nav>}
      </section>
    </section>
  );
}

/** The reason for a blocked delete stays visible and is linked to the disabled button for assistive technology. */
export function DeleteAction({ student, disabled, onDelete }: { student: StudentRecord; disabled: boolean; onDelete: () => void }) {
  const blocked = deleteBlockedReason(student);
  const noteId = `student-delete-blocked-${student.rollNumber}`;
  return <>
    <button className="student-icon-button student-icon-button--danger" type="button" title={blocked ?? `Delete ${student.name}`}
      aria-label={`Delete ${student.name}`} aria-describedby={blocked ? noteId : undefined} disabled={disabled || !!blocked}
      onClick={onDelete}><Trash2 size={15} /></button>
    {blocked && <p className="student-action-note" id={noteId}>{blocked}</p>}
  </>;
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

function StudentEditorModal({ children, onClose, labelledBy = "student-editor-title" }: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy?: string;
}) {
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
    <section className="student-modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      {children}
    </section>
  </div>;
}

/** Cohort/cycle association for a programme, graduation year and cycle; null when the cohort is new. */
function cohortLinked(options: Options, programmeId: string, batchYear: number, cycleId: string) {
  const cohort = options.cohorts.find(c => c.programmeId === programmeId && c.graduationYear === batchYear);
  return cohort ? cohort.cycleIds.includes(cycleId) : null;
}

function StudentEditor({ initial, options, onCancel, onSaved }: {
  initial: StudentRecord | null;
  options: Options;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const registered = initial?.participations.filter(p => p.registrationStatus === "REGISTERED") ?? [];
  const baseline = {
    rollNumber: initial ? String(initial.rollNumber) : "", name: initial?.name ?? "",
    programmeId: initial?.programmeId ?? "", batchYear: initial ? String(initial.batchYear) : "",
    admissionYear: initial?.admissionYear == null ? "" : String(initial.admissionYear),
    cycleId: "", registrationStatus: "",
    // A new offer on an existing student goes to an explicitly shown cycle: the only REGISTERED one, or the admin's choice.
    offerCycleId: initial?.offer?.cycleId ?? (registered.length === 1 ? registered[0].cycleId : ""),
    companyId: initial?.offer?.companyId ?? "", jobRole: initial?.offer?.jobRole ?? "",
    packageLpa: initial?.offer?.packageLpa ?? "", offerType: initial?.offer?.offerType ?? "",
    offerDate: initial?.offer?.offerDate ?? "",
  };
  const [draft, setDraft] = useState(baseline);
  const [hasOffer, setHasOffer] = useState(!!initial?.offer);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [companyDraft, setCompanyDraft] = useState({ name: "", domain: "" });
  const [companyResult, setCompanyResult] = useState<StudentResult>({});
  const [createdCompanies, setCreatedCompanies] = useState<CompanyOption[]>([]);
  const companyOptions = [...options.companies, ...createdCompanies.filter(created =>
    !options.companies.some(company => company.companyId === created.companyId))]
    .sort((a, b) => a.name.localeCompare(b.name));
  const [result, setResult] = useState<StudentResult>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  type Field = keyof typeof baseline;
  // An offer needs a REGISTERED participation: an existing one, or the registration chosen for a new student.
  const canAddOffer = initial ? registered.length > 0 : draft.cycleId !== "" && draft.registrationStatus === "REGISTERED";
  const offerOpen = hasOffer && (!!initial?.offer || canAddOffer);
  const set = (key: Field, value: string) => { setDraft(d => ({ ...d, [key]: value })); setResult({}); };
  function payload() {
    const offer = {
      ...(initial?.offer ? {} : { cycleId: initial ? draft.offerCycleId : draft.cycleId }),
      companyId: draft.companyId, jobRole: draft.jobRole,
      packageLpa: draft.packageLpa, offerType: draft.offerType, offerDate: draft.offerDate,
    };
    return {
      rollNumber: draft.rollNumber, name: draft.name, programmeId: draft.programmeId,
      batchYear: draft.batchYear, admissionYear: draft.admissionYear,
      ...(!initial && (draft.cycleId || draft.registrationStatus)
        ? { participation: { cycleId: draft.cycleId, registrationStatus: draft.registrationStatus } } : {}),
      ...(offerOpen ? { offer } : {}),
    };
  }
  function validateOnBlur(key: string) {
    const { fieldErrors } = validateStudent(payload(), true);
    setResult(r => ({ ...r, fieldErrors: { ...r.fieldErrors, [key]: fieldErrors[key] ?? "" } }));
  }
  function field(key: Field, label: string, extra: { readOnly?: boolean; inputMode?: "numeric" | "decimal"; type?: string; maxLength?: number } = {}) {
    return <div className="student-field" key={key}>
      <label htmlFor={`student-${key}`}>{label}</label>
      <input id={`student-${key}`} value={draft[key]} {...extra} disabled={pending}
        onChange={e => set(key, e.target.value)} onBlur={() => validateOnBlur(key)}
        aria-invalid={!!result.fieldErrors?.[key]} aria-describedby={`student-error-${key}`} />
      <span className="student-field-error" id={`student-error-${key}`}>{result.fieldErrors?.[key]}</span>
    </div>;
  }
  function choice(key: Field, label: string, choices: [string, string][], extra: { disabled?: boolean; errorKey?: string } = {}) {
    const errorKey = extra.errorKey ?? key;
    return <div className="student-field" key={key}>
      <label htmlFor={`student-${key}`}>{label}</label>
      <select id={`student-${key}`} value={draft[key]} disabled={pending || extra.disabled}
        onChange={e => set(key, e.target.value)}
        aria-invalid={!!result.fieldErrors?.[errorKey]} aria-describedby={`student-error-${key}`}>
        {choices.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
      <span className="student-field-error" id={`student-error-${key}`}>{result.fieldErrors?.[errorKey]}</span>
    </div>;
  }
  const linked = !initial && draft.cycleId && draft.programmeId && /^\d{4}$/.test(draft.batchYear)
    ? cohortLinked(options, draft.programmeId, Number(draft.batchYear), draft.cycleId) : true;
  return <form className="panel student-editor" noValidate onSubmit={e => {
    e.preventDefault();
    if (creatingCompany || pending) return;
    const complete = payload();
    const validated = validateStudent(complete, true);
    if (Object.keys(validated.fieldErrors).length) { setResult({ fieldErrors: validated.fieldErrors }); return; }
    const changes: Record<string, unknown> = {};
    for (const key of ["name", "admissionYear"] as const) if (draft[key] !== baseline[key]) changes[key] = draft[key];
    if (offerOpen) {
      const offer: Record<string, unknown> = {};
      if (!initial?.offer) offer.cycleId = draft.offerCycleId;
      for (const key of ["companyId", "jobRole", "packageLpa", "offerType", "offerDate"] as const) {
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
      {choice("programmeId", "Programme", [["", "Choose a programme"], ...options.programmes.map(p => [p.programmeId, p.label] as [string, string])],
        { disabled: !!initial })}
      {field("batchYear", "Graduating batch", { inputMode: "numeric", readOnly: !!initial })}
      {field("admissionYear", "Admission year (optional)", { inputMode: "numeric", maxLength: 4 })}
    </div>
    {!options.programmes.length && <p className="student-note">This department has no undergraduate programme yet, so students cannot be added.</p>}
    {initial && <p className="student-note">Programme and batch cannot be changed here: moving a student would discard registrations and offer details. Use the registrations button in the table to manage placement cycles.</p>}
    {!initial && <fieldset disabled={pending} className="student-company-create">
      <legend>Placement-cycle registration (optional)</legend>
      <p className="student-note">Choose an existing cycle and the student&apos;s status. Nothing is assumed when this is left blank.</p>
      <div className="student-fields">
        {choice("cycleId", "Placement cycle", [["", "No registration yet"], ...options.cycles.map(c => [c.cycleId, c.code] as [string, string])],
          { errorKey: "participation" })}
        {choice("registrationStatus", "Registration status", [["", "Choose a status"], ...REGISTRATION_STATUSES.map(s => [s, s] as [string, string])])}
      </div>
      {!options.cycles.length && <p className="student-note">No placement cycles exist yet. Cycles are not created from the student editor.</p>}
      {linked === null && <p className="student-note">This programme has no {draft.batchYear} cohort yet; saving creates it and associates it with the chosen cycle.</p>}
      {linked === false && <p className="student-note">The {draft.batchYear} cohort is not yet associated with this cycle; saving associates it.</p>}
    </fieldset>}
    {!initial?.offer && <label className="student-offer-toggle"><input type="checkbox" checked={hasOffer} disabled={pending || !canAddOffer}
      onChange={e => { setHasOffer(e.target.checked); if (!e.target.checked) setCreatingCompany(false); }} /> Add an offer</label>}
    {!initial?.offer && !canAddOffer && <p className="student-note">{initial
      ? "An offer needs a REGISTERED placement-cycle registration. Add one with the registrations button first."
      : "To add an offer, choose a placement cycle with the status REGISTERED."}</p>}
    {offerOpen && <div className="student-fields">
      {initial?.offer
        ? <label className="student-field">Placement cycle<input readOnly value={initial.offer.cycleCode} /></label>
        : initial
          ? choice("offerCycleId", "Placement cycle", [["", "Choose a cycle"], ...registered.map(p => [p.cycleId, p.cycleCode] as [string, string])])
          : <label className="student-field">Placement cycle<input readOnly value={options.cycles.find(c => c.cycleId === draft.cycleId)?.code ?? ""} /></label>}
      <div className="student-field">
        <label htmlFor="student-companyId">Company</label>
        <select id="student-companyId" value={draft.companyId} disabled={pending} aria-invalid={!!result.fieldErrors?.companyId}
          aria-describedby="student-error-companyId"
          onChange={e => set("companyId", e.target.value)}>
          <option value="">Select an existing company</option>
          {companyOptions.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
        </select>
        <span className="student-field-error" id="student-error-companyId">{result.fieldErrors?.companyId}</span>
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
                    setDraft(current => ({ ...current, companyId: company.companyId }));
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
      <label className="student-field">Sector<input readOnly value={companyOptions.find(c => c.companyId === draft.companyId)?.domain ?? ""} /></label>
      {field("jobRole", "Job role (optional)")}
      {field("packageLpa", "Package in LPA (optional)", { inputMode: "decimal" })}
      <label className="student-field">Offer type (optional)
        <select value={draft.offerType} disabled={pending} onChange={e => set("offerType", e.target.value)}>
          <option value="">Not recorded</option>{OFFER_TYPES.map(t => <option key={t}>{t}</option>)}
        </select><span className="student-field-error">{result.fieldErrors?.offerType}</span>
      </label>
      <div className="student-field">
        <label htmlFor="student-offerDate">Offer date (optional)</label>
        <DatePicker id="student-offerDate" value={draft.offerDate} disabled={pending}
          onChange={(value) => set("offerDate", value)} />
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

/**
 * Placement-cycle registrations of one enrollment. Each change is its own explicit, confirmed save
 * against the record shown, so it never mixes with an unsaved student draft.
 */
function RegistrationEditor({ student, options, onClose }: {
  student: StudentRecord | null;
  options: Options;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({ cycleId: "", registrationStatus: "" });
  const [result, setResult] = useState<StudentResult>({});
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const heading = <div className="student-editor-heading">
    <h2 id="student-registrations-title">{student ? `Registrations · ${student.rollNumber} ${student.name}` : "Registrations"}</h2>
    <button type="button" className="student-editor-close" onClick={onClose} disabled={pending} aria-label="Close registrations">×</button>
  </div>;
  if (!student) return <div className="panel student-editor">{heading}<p role="alert">This student no longer exists. Close and refresh the records.</p></div>;

  const expected = JSON.stringify(student);
  const linkedCycles = options.cohorts.find(c => c.cohortId === student.cohortId)?.cycleIds ?? [];
  const available = options.cycles.filter(c => !student.participations.some(p => p.cycleId === c.cycleId));
  function save(action: () => Promise<StudentResult>, done: string) {
    setResult({});
    setNotice("");
    startTransition(async () => {
      try {
        const saved = await action();
        if (saved.ok) {
          setNotice(done);
          setDraft({ cycleId: "", registrationStatus: "" });
          router.refresh();
        } else setResult(saved);
      } catch { setResult({ error: "Unable to save. Check your connection and retry." }); }
    });
  }
  const problem = result.error || result.fieldErrors?.form || result.fieldErrors?.participation ||
    result.fieldErrors?.registrationStatus || result.fieldErrors?.rollNumber;
  return <div className="panel student-editor">
    {heading}
    <p className="student-note">Each change is saved immediately. A cycle that holds the student&apos;s offer cannot become UNREGISTERED or be removed; remove the offer first.</p>
    {student.participations.length ? <ul className="student-registrations">
      {student.participations.map(p => {
        const holdsOffer = student.offer?.cycleId === p.cycleId;
        const next = p.registrationStatus === "REGISTERED" ? "UNREGISTERED" : "REGISTERED";
        return <li key={p.cycleId}>
          <strong>{p.cycleCode}</strong>
          <span className={`student-status student-status--${p.registrationStatus === "REGISTERED" ? "registered" : "unregistered"}`}>{p.registrationStatus}</span>
          {holdsOffer && <span className="student-cycle">Offer: {student.offer!.companyName}</span>}
          <div className="student-row-actions">
            <button type="button" disabled={pending || (holdsOffer && next === "UNREGISTERED")} onClick={() => {
              if (!window.confirm(`Mark ${student.name} ${next} for ${p.cycleCode}?`)) return;
              save(() => setStudentParticipation(student.rollNumber, { cycleId: p.cycleId, registrationStatus: next }, expected),
                `Marked ${next} for ${p.cycleCode}.`);
            }}>Mark {next}</button>
            <button type="button" disabled={pending || holdsOffer} onClick={() => {
              if (!window.confirm(`Remove ${student.name}'s ${p.cycleCode} registration?`)) return;
              save(() => removeStudentParticipation(student.rollNumber, p.cycleId, expected), `Removed the ${p.cycleCode} registration.`);
            }}>Remove</button>
          </div>
        </li>;
      })}
    </ul> : <p className="student-note">No placement-cycle registration is recorded for this student.</p>}
    <fieldset disabled={pending} className="student-company-create">
      <legend>Add a registration</legend>
      {available.length ? <>
        <div className="student-fields">
          <label className="student-field">Placement cycle
            <select value={draft.cycleId} onChange={e => { setDraft(d => ({ ...d, cycleId: e.target.value })); setResult({}); }}>
              <option value="">Choose a cycle</option>
              {available.map(c => <option key={c.cycleId} value={c.cycleId}>{c.code}</option>)}
            </select>
          </label>
          <label className="student-field">Registration status
            <select value={draft.registrationStatus} onChange={e => { setDraft(d => ({ ...d, registrationStatus: e.target.value })); setResult({}); }}>
              <option value="">Choose a status</option>
              {REGISTRATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        {draft.cycleId && !linkedCycles.includes(draft.cycleId) &&
          <p className="student-note">The {student.batchYear} cohort is not yet associated with this cycle; saving associates it.</p>}
        <div className="student-row-actions"><button type="button" onClick={() => {
          const checked = validateParticipation(draft);
          if (!checked.data) { setResult({ fieldErrors: checked.fieldErrors }); return; }
          const code = options.cycles.find(c => c.cycleId === checked.data!.cycleId)?.code ?? "the cycle";
          save(() => setStudentParticipation(student.rollNumber, checked.data!, expected), `Registered ${checked.data!.registrationStatus} for ${code}.`);
        }}>Add registration</button></div>
      </> : <p className="student-note">{options.cycles.length
        ? "The student already has a registration for every existing cycle."
        : "No placement cycles exist yet. Cycles are not created from the student editor."}</p>}
    </fieldset>
    {problem && <p role="alert">{problem}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="student-row-actions"><button type="button" onClick={onClose} disabled={pending}>Close</button></div>
  </div>;
}
