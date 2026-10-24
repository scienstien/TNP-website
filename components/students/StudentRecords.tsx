"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  ChevronDown,
  CircleSlash2,
  ClipboardList,
  Plus,
  Pencil,
  Search,
  Trash2,
  UsersRound,
} from "lucide-react";
import {
  createStudent,
  createPlacementCycle,
  createStudentCompany,
  deleteStudent,
  patchStudent,
  removeStudentOffer,
  removeStudentParticipation,
  setStudentParticipation,
} from "@/lib/students/actions";
import { validateCompany } from "@/lib/students/company-validation";
import { validateParticipation, validateStudent } from "@/lib/students/validation";
import { OFFER_TYPES, REGISTRATION_STATUSES } from "@/lib/placements/types";
import type { CompanyOption, StudentData, StudentDegreeLevel, StudentRecord, StudentResult } from "@/lib/students/types";
import { DatePicker } from "@/components/ui/date-picker";
import "./students.css";

type Options = Omit<StudentData, "students" | "level">;
type Status = "Placed" | "Unplaced" | "Not registered";

/** Derived, never stored: an offer means placed; REGISTERED without an offer means unplaced. */
export const statusOf = (student: StudentRecord, cycleId: string): Status => {
  const participation = student.participations.find(item => item.cycleId === cycleId);
  return participation?.registrationStatus === "REGISTERED"
    ? student.offer?.cycleId === cycleId ? "Placed" : "Unplaced"
    : "Not registered";
};
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

/** Placement status and offer type are independent filters; offer type is never a status. */
export const matchesPlacementStatus = (student: StudentRecord, filter: string, cycleId: string) =>
  filter === "All" || (cycleId
    ? statusOf(student, cycleId) === filter
    : student.participations.length
      ? student.participations.some(p => statusOf(student, p.cycleId) === filter)
      : filter === "Not registered");
export const matchesOfferType = (student: StudentRecord, filter: string) =>
  filter === "All" || student.offer?.offerType === filter;

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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [cycleFilter, setCycleFilter] = useState("All");
  const [offerTypeFilter, setOfferTypeFilter] = useState("All");
  const [batchFilter, setBatchFilter] = useState("All");
  const [companyFilter, setCompanyFilter] = useState("All");
  const [expandedRoll, setExpandedRoll] = useState<number | null>(null);
  const [editing, setEditing] = useState<StudentRecord | "new" | null>(null);
  const [registrationsRoll, setRegistrationsRoll] = useState<number | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [registrationDirty, setRegistrationDirty] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { students, level, ...options } = data;
  const cycles = options.cycles;
  const selectedCycleId = cycleFilter === "All" ? "" : cycleFilter;
  const busy = pending || editing !== null || registrationsRoll !== null;
  const batches = [...new Set(students.map(s => s.batchYear))]
    .sort((a, b) => b - a);
  const companies = [...new Set(students.flatMap(s => s.offer ? [s.offer.companyName] : []))]
    .sort((a, b) => a.localeCompare(b));
  const statusRows = selectedCycleId
    ? students.filter(s => s.participations.some(p => p.cycleId === selectedCycleId))
      .map(s => statusOf(s, selectedCycleId))
    : students.flatMap(s => s.participations.map(p => statusOf(s, p.cycleId)));
  const placedCount = statusRows.filter(status => status === "Placed").length;
  const unplacedCount = statusRows.filter(status => status === "Unplaced").length;
  const visible = students.filter(s =>
    `${s.rollNumber} ${s.name} ${s.programmeLabel} ${s.batchYear} ${s.participations.map(p => p.cycleCode).join(" ")} ${s.offer?.companyName ?? ""}`
      .toLowerCase().includes(query.toLowerCase()) &&
    (batchFilter === "All" || s.batchYear === Number(batchFilter)) &&
    (companyFilter === "All" || s.offer?.companyName === companyFilter) &&
    matchesPlacementStatus(s, statusFilter, selectedCycleId) && matchesOfferType(s, offerTypeFilter));
  const clearFilters = () => {
    setQuery("");
    setBatchFilter("All");
    setCompanyFilter("All");
    setStatusFilter("All");
    setOfferTypeFilter("All");
    setCycleFilter("All");
  };
  const activeFilters = [
    query && { label: `Search: ${query}`, clear: () => setQuery("") },
    batchFilter !== "All" && { label: `Batch: ${batchFilter}`, clear: () => setBatchFilter("All") },
    companyFilter !== "All" && { label: `Company: ${companyFilter}`, clear: () => setCompanyFilter("All") },
    statusFilter !== "All" && { label: `Status: ${statusFilter}`, clear: () => setStatusFilter("All") },
    offerTypeFilter !== "All" && { label: `Offer type: ${offerTypeFilter}`, clear: () => setOfferTypeFilter("All") },
    cycleFilter !== "All" && { label: `Cycle: ${cycles.find(c => c.cycleId === cycleFilter)?.code ?? "Selected"}`, clear: () => setCycleFilter("All") },
  ].filter(Boolean) as { label: string; clear: () => void }[];
  function remove(student: StudentRecord, offer: boolean) {
    if (!window.confirm(removalConfirmation(student, offer))) return;
    startTransition(async () => {
      const send = offer
        ? (roll: number, expected: string) => removeStudentOffer(level, roll, expected)
        : (roll: number, expected: string) => deleteStudent(level, roll, expected);
      const { feedback, refresh } = await sendRemoval(student, send);
      setFeedback(feedback);
      if (refresh) router.refresh();
    });
  }
  return (
    <section className="student-records">
      <div className="section-heading">
        <div className="student-heading-copy">
          <p className="student-eyebrow">{level} PLACEMENT ROSTER</p>
          <h1>{level === "UG" ? "UG Student Directory" : "PG Student Directory"}</h1>
          <p>Search, filter, and manage student registrations and recorded offers.</p>
        </div>
        <div className="student-heading-actions">
          <button className="dark-button" disabled={busy}
            onClick={() => { setEditing("new"); setFeedback(null); }}>Add {level} student</button>
        </div>
      </div>
      {feedback?.alert && <p role="alert">{feedback.text}</p>}
      {feedback && !feedback.alert && <p role="status">{feedback.text}</p>}
      {editing && <StudentEditorModal onClose={() => { setEditing(null); setEditorDirty(false); router.refresh(); }} isDirty={editorDirty}>
        <StudentEditor key={editing === "new" ? "new" : editing.rollNumber}
          initial={editing === "new" ? null : editing} options={options} level={level}
          onCancel={() => { setEditing(null); router.refresh(); }}
          onDirtyChange={setEditorDirty}
          onSaved={() => { setEditing(null); setFeedback({ text: "Saved to the database.", alert: false }); }} />
      </StudentEditorModal>}
      {registrationsRoll !== null && <StudentEditorModal labelledBy="student-registrations-title"
        onClose={() => { setRegistrationsRoll(null); setRegistrationDirty(false); router.refresh(); }} isDirty={registrationDirty}>
        <RegistrationEditor student={students.find(s => s.rollNumber === registrationsRoll) ?? null} options={options} level={level}
          onClose={() => { setRegistrationsRoll(null); router.refresh(); }}
          onDirtyChange={setRegistrationDirty} />
      </StudentEditorModal>}
      <div className="student-table-stats" aria-label="Student record summary">
        <Stat label="Recorded students" value={students.length} icon={UsersRound} />
        <Stat label={selectedCycleId ? "Placed students" : "Placed cycles"} value={placedCount} icon={BriefcaseBusiness} tone="placed" />
        <Stat label={selectedCycleId ? "Unplaced students" : "Unplaced cycles"} value={unplacedCount} icon={CircleSlash2} tone="unplaced" />
      </div>
      <section className="panel table-panel student-table-card">
        <div className="student-toolbar">
          <div className="student-toolbar-controls">
            <label className="student-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Search students</span>
              <input value={query} placeholder="Search name, roll number, cycle or company"
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
            <FilterSelect label="Cycle" value={cycleFilter} onChange={setCycleFilter}>
              <option value="All">All cycles</option>
              {cycles.map(cycle => <option key={cycle.cycleId} value={cycle.cycleId}>{cycle.code}</option>)}
            </FilterSelect>
            <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter}>
              {["All", "Placed", "Unplaced", "Not registered"].map(status => <option key={status}>{status}</option>)}
            </FilterSelect>
            <FilterSelect label="Offer type" value={offerTypeFilter} onChange={setOfferTypeFilter}>
              <option value="All">All offer types</option>
              {OFFER_TYPES.map(type => <option key={type}>{type}</option>)}
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
              {visible.length ? `Showing 1–${visible.length} of ${students.length}` : `Showing 0 of ${students.length}`}
            </span>
          </div>
        </div>
        {!visible.length && <p className="table-hint" role="status">{students.length
          ? "No students match the current filters." : "No student records loaded."}</p>}
        {!!visible.length && <div className="student-card-list">{visible.map(s => {
          const expanded = expandedRoll === s.rollNumber;
          const panelId = `student-details-${s.rollNumber}`;
          const selectedStatus = selectedCycleId ? statusOf(s, selectedCycleId) : null;
          const summaryStatus: Status = selectedStatus ?? (s.offer
            ? "Placed"
            : s.participations.some(participation => participation.registrationStatus === "REGISTERED")
              ? "Unplaced"
              : "Not registered");
          const companyDescription = options.companies.find(c => c.companyId === s.offer?.companyId)?.domain ?? null;
          return <article key={s.rollNumber} className={`student-record-card${expanded ? " student-record-card--expanded" : ""}`}>
            <div className="student-record-summary">
              <button type="button" className="student-record-toggle" aria-expanded={expanded} aria-controls={panelId}
                onClick={() => setExpandedRoll(expanded ? null : s.rollNumber)}>
                <span className="student-record-identity">
                  <strong>{s.name}</strong>
                  <span>{s.rollNumber}</span>
                </span>
                <span className="student-record-facts">
                  <span><b>Programme</b>{s.programmeLabel}</span>
                  <span><b>Batch</b>{s.batchYear}</span>
                  <span><b>Placement cycle</b>{selectedCycleId
                    ? cycles.find(c => c.cycleId === selectedCycleId)?.code ?? "Selected cycle"
                    : s.participations.length ? s.participations.map(participation => participation.cycleCode).join(", ") : "Not recorded"}</span>
                  <span><b>Company</b>{s.offer?.companyName ?? "No final offer"}</span>
                </span>
                <span className="student-record-state">
                  <span className={`student-status student-status--${statusClass[summaryStatus]}`}>{summaryStatus}</span>
                  <span className="student-record-action">{expanded ? "Hide details" : "View details"}<ChevronDown size={17} aria-hidden="true" /></span>
                </span>
              </button>
              <div className="student-card-actions" aria-label={`Actions for ${s.name}`}>
                <button className="student-icon-button" type="button" title={`Edit ${s.name}`} aria-label={`Edit ${s.name}`}
                  disabled={busy} onClick={() => { setEditing(s); setFeedback(null); }}><Pencil size={15} /></button>
                <button className="student-icon-button" type="button" title={`${s.name}'s placement-cycle registrations`}
                  aria-label={`Registrations for ${s.name}`} disabled={busy}
                  onClick={() => { setRegistrationsRoll(s.rollNumber); setFeedback(null); }}><ClipboardList size={15} /></button>
                {s.offer && <button className="student-icon-button student-icon-button--warning" type="button" title={`Remove ${s.name}'s offer`} aria-label={`Remove ${s.name}'s offer`}
                  disabled={busy} onClick={() => remove(s, true)}><BriefcaseBusiness size={15} /></button>}
                <DeleteAction student={s} disabled={busy} onDelete={() => remove(s, false)} />
              </div>
            </div>
            {expanded && <div id={panelId} className="student-record-details">
              <dl className="student-detail-grid">
                <div><dt>Gender</dt><dd>{options.genderTypes.find(option => option.code === s.genderCode)?.label ?? "Not recorded"}</dd></div>
                <div><dt>Category</dt><dd>{options.reservationCategories.find(option => option.code === s.reservationCategoryCode)?.label ?? "Not recorded"}</dd></div>
                <div><dt>Admission year</dt><dd>{s.admissionYear ?? "Not recorded"}</dd></div>
                <div><dt>Programme</dt><dd>{s.programmeLabel}</dd></div>
                <div className="student-detail-wide"><dt>Placement cycles</dt><dd>{s.participations.length ? <span className="student-cycles">{s.participations.map(p =>
                  <span key={p.cycleId} className={`student-cycle${p.registrationStatus === "UNREGISTERED" ? " student-cycle--unregistered" : ""}`}>
                    {p.cycleCode}{p.registrationStatus === "UNREGISTERED" ? " · unregistered" : ""}
                  </span>)}</span> : "Not recorded"}</dd></div>
                <div className="student-detail-wide"><dt>Placement status</dt><dd>{s.participations.length ? <span className="student-cycles">{s.participations.map(p => {
                  const status = statusOf(s, p.cycleId);
                  return <span key={p.cycleId} className={`student-status student-status--${statusClass[status]}`}>{p.cycleCode}: {status}</span>;
                })}</span> : <span className="student-status student-status--unregistered">No cycle</span>}</dd></div>
                <div><dt>Company</dt><dd>{s.offer?.companyName ?? "Not recorded"}</dd></div>
                <div><dt>Description</dt><dd>{companyDescription ?? "Not recorded"}</dd></div>
                <div><dt>Job role</dt><dd>{s.offer?.jobRole ?? "Not recorded"}</dd></div>
                <div><dt>Offer type</dt><dd>{s.offer?.offerType ?? "Not recorded"}</dd></div>
                <div><dt>CTC (LPA)</dt><dd>{s.offer?.packageLpa ?? "Not recorded"}</dd></div>
                <div><dt>Offer date</dt><dd>{s.offer?.offerDate ?? "Not recorded"}</dd></div>
              </dl>
            </div>}
          </article>;
        })}</div>}
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

function StudentEditorModal({ children, onClose, labelledBy = "student-editor-title", isDirty }: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy?: string;
  isDirty: boolean;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  const dirtyRef = useRef(isDirty);
  useEffect(() => { closeRef.current = onClose; dirtyRef.current = isDirty; }, [onClose, isDirty]);
  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter(element => element.offsetParent !== null);
    const first = focusable()[0];
    (first ?? dialogRef.current)?.focus();
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!dirtyRef.current || window.confirm("Discard your unsaved changes?")) closeRef.current();
      }
      if (event.key === "Tab") {
        const items = focusable();
        if (!items.length) { event.preventDefault(); dialogRef.current?.focus(); return; }
        const firstItem = items[0], lastItem = items[items.length - 1];
        if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus(); }
        else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
      }
    };
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("keydown", keyHandler);
      openerRef.current?.focus();
    };
  }, []);
  const requestClose = () => {
    if (!dirtyRef.current || window.confirm("Discard your unsaved changes?")) closeRef.current();
  };
  const interceptClose = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest("[data-modal-close]")) {
      event.preventDefault();
      event.stopPropagation();
      requestClose();
    }
  };

  return <div className="student-modal-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) requestClose();
  }}>
    <section className="student-modal" ref={dialogRef} onClickCapture={interceptClose} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      {children}
    </section>
  </div>;
}

/** Cohort/cycle association for a programme, graduation year and cycle; null when the cohort is new. */
function cohortLinked(options: Options, programmeId: string, batchYear: number, cycleId: string) {
  const cohort = options.cohorts.find(c => c.programmeId === programmeId && c.graduationYear === batchYear);
  return cohort ? cohort.cycleIds.includes(cycleId) : null;
}

function StudentEditor({ initial, options, level, onCancel, onSaved, onDirtyChange }: {
  initial: StudentRecord | null;
  options: Options;
  level: StudentDegreeLevel;
  onCancel: () => void;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [cycleOptions, setCycleOptions] = useState(options.cycles);
  const cycles = cycleOptions;
  const registered = initial?.participations.filter(p => p.registrationStatus === "REGISTERED") ?? [];
  const baseline = {
    rollNumber: initial ? String(initial.rollNumber) : "", name: initial?.name ?? "",
    genderCode: initial?.genderCode ?? "", reservationCategoryCode: initial?.reservationCategoryCode ?? "",
    programmeId: initial?.programmeId ?? "", batchYear: initial ? String(initial.batchYear) : "",
    admissionYear: initial?.admissionYear == null ? "" : String(initial.admissionYear),
    cycleId: "", registrationStatus: "",
    // A new offer on an existing student goes to an explicitly shown cycle: the only REGISTERED one, or the admin's choice.
    offerCycleId: initial?.offer?.cycleId ?? (registered.length === 1 ? registered[0].cycleId : ""),
    companyId: initial?.offer?.companyId ?? "", driveId: initial?.offer?.driveId ?? "",
    roleId: initial?.offer?.roleId ?? "",
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
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline) || hasOffer !== !!initial?.offer || creatingCompany ||
    companyDraft.name !== "" || companyDraft.domain !== "";
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const router = useRouter();
  type Field = keyof typeof baseline;
  // An offer needs a REGISTERED participation: an existing one, or the registration chosen for a new student.
  const canAddOffer = initial ? registered.length > 0 : draft.cycleId !== "" && draft.registrationStatus === "REGISTERED";
  const offerOpen = hasOffer && (!!initial?.offer || canAddOffer);
  const set = (key: Field, value: string) => { setDraft(d => ({ ...d, [key]: value })); setResult({}); };
  const offerCycleId = initial?.offer ? initial.offer.cycleId : initial ? draft.offerCycleId : draft.cycleId;
  const availableDrives = options.drives.filter(drive => drive.companyId === draft.companyId && drive.cycleId === offerCycleId);
  const selectedDrive = availableDrives.find(drive => drive.driveId === draft.driveId);
  function payload() {
    const offer = {
      ...(initial?.offer ? {} : { cycleId: initial ? draft.offerCycleId : draft.cycleId }),
      companyId: draft.companyId, driveId: draft.driveId || null, roleId: draft.roleId || null,
      packageLpa: draft.packageLpa, offerType: draft.offerType, offerDate: draft.offerDate,
    };
    return {
      rollNumber: draft.rollNumber, name: draft.name, programmeId: draft.programmeId,
      batchYear: draft.batchYear, admissionYear: draft.admissionYear,
      genderCode: draft.genderCode, reservationCategoryCode: draft.reservationCategoryCode,
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
    for (const key of ["name", "genderCode", "reservationCategoryCode", "admissionYear"] as const) {
      if (draft[key] !== baseline[key]) changes[key] = draft[key];
    }
    if (offerOpen) {
      const offer: Record<string, unknown> = {};
      if (!initial?.offer) offer.cycleId = draft.offerCycleId;
      for (const key of ["companyId", "driveId", "roleId", "packageLpa", "offerType", "offerDate"] as const) {
        if (!initial?.offer || draft[key] !== baseline[key]) offer[key] = draft[key];
      }
      if (Object.keys(offer).length) changes.offer = offer;
    }
    startTransition(async () => {
      try {
        const saved = initial
          ? await patchStudent(level, initial.rollNumber, changes, JSON.stringify(initial))
          : await createStudent(level, complete);
        setResult(saved);
        if (saved.ok) { router.refresh(); onSaved(); }
      } catch { setResult({ error: "Unable to save. Your draft is preserved; try again." }); }
    });
  }}>
    <div className="student-editor-heading">
      <h2 id="student-editor-title">{initial ? `Edit ${level} ${initial.rollNumber}` : `Add ${level} student — unsaved draft`}</h2>
      <button type="button" data-modal-close className="student-editor-close" onClick={onCancel} disabled={pending} aria-label="Close editor">×</button>
    </div>
    <div className="student-fields">
      <label className="student-field">Degree level<input readOnly value={level} /></label>
      {field("rollNumber", "Roll number (9 digits)", { inputMode: "numeric", readOnly: !!initial })}
      {field("name", "Student name")}
      {choice("genderCode", "Gender (optional)", [["", "Not recorded"], ...options.genderTypes.map(o => [o.code, o.label] as [string, string])])}
      {choice("reservationCategoryCode", "Reservation category (optional)", [["", "Not recorded"], ...options.reservationCategories.map(o => [o.code, o.label] as [string, string])])}
      {choice("programmeId", "Programme", [["", "Choose a programme"], ...options.programmes.map(p => [p.programmeId, p.label] as [string, string])],
        { disabled: !!initial })}
      {field("batchYear", "Graduating batch", { inputMode: "numeric", readOnly: !!initial })}
      {field("admissionYear", "Admission year (optional)", { inputMode: "numeric", maxLength: 4 })}
    </div>
    {!options.programmes.length && <p className="student-note">This department has no {level} programme yet, so students cannot be added.</p>}
    {initial && <p className="student-note">Programme and batch cannot be changed here: moving a student would discard registrations and offer details. Use the registrations button in the table to manage placement cycles.</p>}
    {!initial && <fieldset disabled={pending} className="student-company-create">
      <legend>Placement-cycle registration (optional)</legend>
      <p className="student-note">Choose an existing cycle and the student&apos;s status. Nothing is assumed when this is left blank.</p>
      <div className="student-fields">
        <div className="student-cycle-picker">
          {choice("cycleId", "Placement cycle", [["", "No registration yet"], ...cycles.map(c => [c.cycleId, c.code] as [string, string])],
            { errorKey: "participation" })}
          <button type="button" className="student-cycle-add" title="Add next placement cycle" aria-label="Add next placement cycle" disabled={pending}
            onClick={() => startTransition(async () => {
              const created = await createPlacementCycle();
              if (created.ok && created.cycle) {
                setCycleOptions(current => [...current, created.cycle!].sort((a, b) => b.code.localeCompare(a.code, undefined, { numeric: true })));
                set("cycleId", created.cycle.cycleId);
              } else setResult({ error: created.error ?? "Unable to create the placement cycle." });
            })}>
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
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
          ? <label className="student-field">Placement cycle
            <select value={draft.offerCycleId} disabled={pending} onChange={e => setDraft(d => ({ ...d, offerCycleId: e.target.value, driveId: "", roleId: "" }))}>
              <option value="">Choose a cycle</option>{registered.map(p => <option key={p.cycleId} value={p.cycleId}>{p.cycleCode}</option>)}
            </select>
          </label>
          : <label className="student-field">Placement cycle<input readOnly value={options.cycles.find(c => c.cycleId === draft.cycleId)?.code ?? ""} /></label>}
      <div className="student-field">
        <label htmlFor="student-companyId">Company</label>
        <select id="student-companyId" value={draft.companyId} disabled={pending} aria-invalid={!!result.fieldErrors?.companyId}
          aria-describedby="student-error-companyId"
          onChange={e => setDraft(d => ({ ...d, companyId: e.target.value, driveId: "", roleId: "" }))}>
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
          <label htmlFor="new-company-description">Company description (optional)</label>
          <input id="new-company-description" value={companyDraft.domain}
            aria-invalid={!!companyResult.fieldErrors?.domain} aria-describedby="new-company-description-error"
            onChange={e => { setCompanyDraft(d => ({ ...d, domain: e.target.value })); setCompanyResult({}); }} />
          <span id="new-company-description-error" className="student-field-error">{companyResult.fieldErrors?.domain}</span>
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
                    setDraft(current => ({ ...current, companyId: company.companyId, driveId: "", roleId: "" }));
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
      <label className="student-field">Company description<input readOnly value={companyOptions.find(c => c.companyId === draft.companyId)?.domain ?? ""} /></label>
      <label className="student-field">Drive (optional)
        <select value={draft.driveId} disabled={pending || !draft.companyId || !offerCycleId}
          aria-invalid={!!result.fieldErrors?.driveId} aria-describedby="student-error-driveId"
          onChange={e => setDraft(d => ({ ...d, driveId: e.target.value, roleId: "" }))}>
          <option value="">No drive recorded</option>
          {availableDrives.map(drive => <option key={drive.driveId} value={drive.driveId}>
            {drive.reference || "Unreferenced drive"} · {drive.cycleCode} · {drive.driveId.slice(0, 8)}
          </option>)}
        </select>
        <span className="student-field-error" id="student-error-driveId">{result.fieldErrors?.driveId}</span>
        {draft.companyId && offerCycleId && !availableDrives.length && <small>No existing drives for this company and cycle. Historical offer details may be saved without a drive.</small>}
      </label>
      <label className="student-field">Role (optional)
        <select value={draft.roleId} disabled={pending || !selectedDrive}
          aria-invalid={!!result.fieldErrors?.roleId} aria-describedby="student-error-roleId"
          onChange={e => set("roleId", e.target.value)}>
          <option value="">No role recorded</option>
          {selectedDrive?.roles.map(role => <option key={role.roleId} value={role.roleId}>
            {role.jobTitle || "Untitled role"}{role.domain ? ` · ${role.domain}` : ""} · {role.roleId.slice(0, 8)}
          </option>)}
        </select>
        <span className="student-field-error" id="student-error-roleId">{result.fieldErrors?.roleId}</span>
      </label>
      {field("packageLpa", "Package in LPA (optional)", { inputMode: "decimal" })}
      <label className="student-field">Offer type (optional)
        <select id="student-offerType" value={draft.offerType} disabled={pending} aria-invalid={!!result.fieldErrors?.offerType}
          aria-describedby="student-error-offerType" onChange={e => set("offerType", e.target.value)}>
          <option value="">Not recorded</option>{OFFER_TYPES.map(t => <option key={t}>{t}</option>)}
        </select><span id="student-error-offerType" className="student-field-error">{result.fieldErrors?.offerType}</span>
      </label>
      <div className="student-field">
        <label htmlFor="student-offerDate">Offer date (optional)</label>
        <DatePicker id="student-offerDate" value={draft.offerDate} disabled={pending}
          ariaInvalid={!!result.fieldErrors?.offerDate} ariaDescribedBy="student-error-offerDate"
          onChange={(value) => set("offerDate", value)} />
        <span id="student-error-offerDate" className="student-field-error">{result.fieldErrors?.offerDate}</span>
      </div>
    </div>}
    {(result.error || result.fieldErrors?.form || result.fieldErrors?.offer) &&
      <p role="alert">{result.error || result.fieldErrors?.form || result.fieldErrors?.offer}</p>}
    <div className="student-row-actions">
      <button type="submit" className="dark-button" disabled={pending || creatingCompany}>{pending ? "Saving…" : "Save"}</button>
      <button type="button" data-modal-close disabled={pending} onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}

/**
 * Placement-cycle registrations of one enrollment. Each change is its own explicit, confirmed save
 * against the record shown, so it never mixes with an unsaved student draft.
 */
function RegistrationEditor({ student, options, level, onClose, onDirtyChange }: {
  student: StudentRecord | null;
  options: Options;
  level: StudentDegreeLevel;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState({ cycleId: "", registrationStatus: "" });
  const [result, setResult] = useState<StudentResult>({});
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const dirty = draft.cycleId !== "" || draft.registrationStatus !== "";
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const router = useRouter();
  const heading = <div className="student-editor-heading">
    <h2 id="student-registrations-title">{student ? `Registrations · ${student.rollNumber} ${student.name}` : "Registrations"}</h2>
    <button type="button" data-modal-close className="student-editor-close" onClick={onClose} disabled={pending} aria-label="Close registrations">×</button>
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
              save(() => setStudentParticipation(level, student.rollNumber, { cycleId: p.cycleId, registrationStatus: next }, expected),
                `Marked ${next} for ${p.cycleCode}.`);
            }}>Mark {next}</button>
            <button type="button" disabled={pending || holdsOffer} onClick={() => {
              if (!window.confirm(`Remove ${student.name}'s ${p.cycleCode} registration?`)) return;
              save(() => removeStudentParticipation(level, student.rollNumber, p.cycleId, expected), `Removed the ${p.cycleCode} registration.`);
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
            <select id="registration-cycle" value={draft.cycleId} aria-invalid={!!result.fieldErrors?.participation}
              aria-describedby="registration-cycle-error" onChange={e => { setDraft(d => ({ ...d, cycleId: e.target.value })); setResult({}); }}>
              <option value="">Choose a cycle</option>
              {available.map(c => <option key={c.cycleId} value={c.cycleId}>{c.code}</option>)}
            </select>
          </label>
          <label className="student-field">Registration status
            <select id="registration-status" value={draft.registrationStatus} aria-invalid={!!result.fieldErrors?.registrationStatus}
              aria-describedby="registration-status-error" onChange={e => { setDraft(d => ({ ...d, registrationStatus: e.target.value })); setResult({}); }}>
              <option value="">Choose a status</option>
              {REGISTRATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <span id="registration-cycle-error" className="student-field-error">{result.fieldErrors?.participation}</span>
        <span id="registration-status-error" className="student-field-error">{result.fieldErrors?.registrationStatus}</span>
        {draft.cycleId && !linkedCycles.includes(draft.cycleId) &&
          <p className="student-note">The {student.batchYear} cohort is not yet associated with this cycle; saving associates it.</p>}
        <div className="student-row-actions"><button type="button" onClick={() => {
          const checked = validateParticipation(draft);
          if (!checked.data) { setResult({ fieldErrors: checked.fieldErrors }); return; }
          const code = options.cycles.find(c => c.cycleId === checked.data!.cycleId)?.code ?? "the cycle";
          save(() => setStudentParticipation(level, student.rollNumber, checked.data!, expected), `Registered ${checked.data!.registrationStatus} for ${code}.`);
        }}>Add registration</button></div>
      </> : <p className="student-note">{options.cycles.length
        ? "The student already has a registration for every existing cycle."
        : "No placement cycles exist yet. Cycles are not created from the student editor."}</p>}
    </fieldset>
    {problem && <p role="alert">{problem}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="student-row-actions"><button type="button" data-modal-close onClick={onClose} disabled={pending}>Close</button></div>
  </div>;
}
