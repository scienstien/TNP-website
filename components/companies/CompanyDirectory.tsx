"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, CalendarCheck2, ChevronDown, ContactRound, Pencil, Plus, Search } from "lucide-react";
import { createCompany, updateCompany } from "@/lib/companies/actions";
import { validateCompanyCreate, validateCompanyUpdate } from "@/lib/companies/validation";
import type { CompanyListRecord, CompanyRecord, CompanyResult, PvrStatus } from "@/lib/companies/types";
import { validateNewCompanyDrives } from "@/lib/drives/rules";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CompanyDrivesEditor, DriveDraftList, confirmDraftsWithoutStages, driveDraftInput, driveDraftProblem, newDriveDraft, useRoleDomains, type DriveDraft } from "./CompanyDriveFields";
import "./companies.css";

type Draft = Omit<CompanyRecord, "companyId" | "name" | "pvrStatus" | "visitDate"> & { pvrStatus: PvrStatus };
type Cycle = { cycleId: string; code: string };
const PAGE_SIZE = 8;

export default function CompanyDirectory({ data, isAdmin, cycle, cycles, selectedCompanyId, onSelect, drivesForId, onCloseDrives, onDrivesChanged, details }: { data: CompanyListRecord[]; isAdmin: boolean; cycle: Cycle | null; cycles: Cycle[]; selectedCompanyId: string | null; onSelect: (id: string | null) => void; drivesForId: string | null; onCloseDrives: () => void; onDrivesChanged: () => void; details: React.ReactNode }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<CompanyRecord | "new" | null>(null);
  // Read the latest row so a refreshed company snapshot is used for later HR saves.
  const drivesFor = data.find(company => company.companyId === drivesForId) ?? null;
  const defaultCycleId = cycle?.cycleId ?? cycles[0]?.cycleId ?? "";
  const [message, setMessage] = useState("");
  const visible = data.filter((company) =>
    `${company.name} ${company.hrName ?? ""} ${company.email ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  const contactCount = data.filter((company) => company.hrName || company.email || company.phoneNumber).length;
  const scheduledVisitCount = data.filter((company) => company.visitDate).length;
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageCompanies = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return <section className="companies-view">
    {message && <p role="status" className="company-message">{message}</p>}
    {editing && isAdmin && <CompanyEditorModal onClose={() => setEditing(null)}><CompanyEditor key={editing === "new" ? "create" : `edit:${editing.companyId}`} company={editing === "new" ? null : editing} cycleCode={cycle?.code ?? null} cycles={cycles} defaultCycleId={defaultCycleId} onCancel={() => setEditing(null)} onSaved={(saved) => {
      setEditing(null); setMessage(saved); setQuery(""); router.refresh();
    }} /></CompanyEditorModal>}
    {drivesFor && isAdmin && <CompanyEditorModal onClose={onCloseDrives}><CompanyDrivesEditor key={drivesFor.companyId} company={drivesFor} cycles={cycles} defaultCycleId={defaultCycleId} onClose={onCloseDrives} onChanged={() => { router.refresh(); onDrivesChanged(); }} /></CompanyEditorModal>}
    <section className="panel company-table-panel company-directory-card">
      <div className="company-directory-header">
        <div className="company-table-stats" aria-label="Company directory summary">
          <CompanyStat label="Companies" value={data.length} icon={Building2} />
          <CompanyStat label="Contacts" value={contactCount} icon={ContactRound} tone="contacts" />
          {cycle && <CompanyStat label="Scheduled PPTs" value={scheduledVisitCount} icon={CalendarCheck2} tone="visits" />}
        </div>
      </div>
      <div className="company-tools">
        <label className="company-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search companies</span><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); onSelect(null); }} placeholder="Search company name or contact" /></label>
        <span role="status">{visible.length} {visible.length === 1 ? "company" : "companies"}</span>
        {isAdmin && <button type="button" className="dark-button company-add" disabled={editing !== null} onClick={() => { setEditing("new"); setMessage(""); }}>Add company</button>}
      </div>
      {!visible.length ? <p className="table-hint">{data.length ? "No companies match your search." : "No companies recorded."}</p> :
        <div className="company-card-list">{pageCompanies.map((company) => {
          const expanded = company.companyId === selectedCompanyId;
          const panelId = `company-details-${company.companyId}`;
          return <article key={company.companyId} className={`company-record-card${expanded ? " company-record-card--expanded" : ""}`}>
            <div className="company-record-summary">
              <button type="button" className="company-record-toggle" aria-expanded={expanded} aria-controls={panelId} onClick={() => onSelect(expanded ? null : company.companyId)}>
                <span className="company-record-heading"><span className="company-record-name">{company.name}</span><Badge className={`pvr pvr-${company.pvrStatus}`}>{company.pvrStatus === "unknown" ? "PVR unknown" : company.pvrStatus === "yes" ? "PVR yes" : "PVR no"}</Badge></span>
                <span className="company-record-facts">
                  <span><b>Description</b>{company.domain ?? "Not recorded"}</span>
                  <span title={cycle ? `Final offers reported in ${cycle.code}` : "Final offers reported in every cycle"}><Briefcase size={14} aria-hidden="true" />{company.offerCount} {company.offerCount === 1 ? "offer" : "offers"} made</span>
                </span>
                <span className="company-record-action">{expanded ? "Hide analytics" : "View analytics"}<ChevronDown size={17} aria-hidden="true" /></span>
              </button>
              {isAdmin && <button type="button" className="company-icon-button company-record-edit" title={`Edit ${company.name}`} aria-label={`Edit ${company.name}`} disabled={editing !== null || drivesFor !== null} onClick={() => { setEditing(company); setMessage(""); }}><Pencil size={15} /></button>}
            </div>
            {expanded && <div id={panelId} className="company-record-details">{company.remarks && <p className="company-record-remarks"><b>Remarks:</b> {company.remarks}</p>}{details}</div>}
          </article>;
        })}</div>}
      {visible.length > PAGE_SIZE && <nav className="company-pagination" aria-label="Company directory pages">
        <button type="button" disabled={safePage === 1} onClick={() => { setPage(value => Math.max(1, value - 1)); onSelect(null); }}>Previous</button>
        <span>Page {safePage} of {pageCount}</span>
        <button type="button" disabled={safePage === pageCount} onClick={() => { setPage(value => Math.min(pageCount, value + 1)); onSelect(null); }}>Next</button>
      </nav>}
    </section>
  </section>;
}

function CompanyStat({ icon: Icon, label, tone, value }: { icon: typeof Building2; label: string; tone?: "contacts" | "visits"; value: number }) {
  return <div className={`company-stat${tone ? ` company-stat--${tone}` : ""}`}><Icon size={15} aria-hidden="true" /><span><strong>{value}</strong>{label}</span></div>;
}

function CompanyEditorModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return <div className="company-modal-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}><section className="company-modal" role="dialog" aria-modal="true" aria-labelledby="company-editor-title">{children}</section></div>;
}

/**
 * Company fields only (description, remarks, PVR). When adding a company, drives (each with
 * its own HR contact, roles and stages) are drafted below and saved together with it.
 * The legacy global HR columns are sent back unchanged on edit and are no longer edited here.
 */
function CompanyEditor({ company, cycleCode, cycles, defaultCycleId, onCancel, onSaved }: { company: CompanyRecord | null; cycleCode: string | null; cycles: Cycle[]; defaultCycleId: string; onCancel: () => void; onSaved: (message: string) => void }) {
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<Draft>({ domain: company?.domain ?? null, hrName: company?.hrName ?? null, email: company?.email ?? null, phoneNumber: company?.phoneNumber ?? null, remarks: company?.remarks ?? null, pvrStatus: company?.pvrStatus ?? "unknown" });
  const [drives, setDrives] = useState<DriveDraft[]>([]);
  const domains = useRoleDomains();
  const [result, setResult] = useState<CompanyResult>({});
  const [pending, startTransition] = useTransition();
  const set = (key: keyof Draft, value: string) => { setDraft((current) => ({ ...current, [key]: value || null })); setResult({}); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    // The HR contact is only asked for alongside a drive.
    // New companies get no legacy global HR contact; each drive carries its own.
    const fields = company ? draft : { ...draft, hrName: null, email: null, phoneNumber: null };
    const checked = company ? validateCompanyUpdate(fields, company.name) : validateCompanyCreate({ name, ...fields });
    if (Object.keys(checked.fieldErrors).length) { setResult({ fieldErrors: checked.fieldErrors }); return; }
    const driveInput = drives.map(driveDraftInput);
    if (!company) {
      const problem = driveDraftProblem(drives);
      if (problem) { setResult({ fieldErrors: { form: problem } }); return; }
      try { validateNewCompanyDrives(driveInput); } catch (error) { setResult({ fieldErrors: { form: error instanceof Error ? error.message : "Invalid drive data." } }); return; }
      if (!drives.length && !window.confirm(`No drive added for ${name.trim() || "this company"}.\n\nAdd the company without a drive? You can add drives later with "Edit drives" in its Drive process card.`)) return;
      if (drives.length && !confirmDraftsWithoutStages(drives)) return;
    }
    startTransition(async () => {
      try {
        const saved = company ? await updateCompany(company.companyId, fields, JSON.stringify(company)) : await createCompany({ name, ...fields, drives: driveInput });
        setResult(saved);
        if (saved.ok) onSaved(company ? "Company changes saved." : drives.length ? `Company added with ${drives.length === 1 ? "1 drive" : `${drives.length} drives`}.` : "Company added without a drive.");
      } catch {
        setResult({ error: "Unable to save. Your draft is unchanged; please retry." });
      }
    });
  };
  const field = (key: keyof Draft, label: string, type = "text") => <label className="company-field">{label}
    <input type={type} value={draft[key] ?? ""} disabled={pending} onChange={(event) => set(key, event.target.value)} aria-invalid={Boolean(result.fieldErrors?.[key as keyof NonNullable<CompanyResult["fieldErrors"]>])} />
    {result.fieldErrors?.[key as keyof NonNullable<CompanyResult["fieldErrors"]>] && <small>{result.fieldErrors[key as keyof NonNullable<CompanyResult["fieldErrors"]>]}</small>}
  </label>;
  return <form className="panel company-editor" onSubmit={submit} noValidate><div className="company-editor-heading"><div><p className="eyebrow">{company ? "EDIT COMPANY" : "NEW COMPANY"}</p><h2 id="company-editor-title">{company?.name ?? "Add company"}</h2><p>{company ? "Company names cannot be edited here. Use \"Edit drives\" in the Drive process card for drives, roles and the HR contact." : "Only the company name is required. Add the drives it held below. Adding a company does not create a placement offer."}</p><p>Companies and drives are shared by every department.</p></div><button type="button" className="company-editor-close" aria-label="Close editor" onClick={onCancel} disabled={pending}>×</button></div>
    <div className="company-fields">
      {!company && <div className="company-field"><label htmlFor="company-create-name">Company name</label>
        <input id="company-create-name" autoFocus required maxLength={120} value={name} disabled={pending} onChange={(event) => { setName(event.target.value); setResult({}); }} aria-invalid={Boolean(result.fieldErrors?.name)} aria-describedby={result.fieldErrors?.name ? "company-name-error" : undefined} />
        {result.fieldErrors?.name && <small id="company-name-error" role="alert">{result.fieldErrors.name}</small>}
      </div>}
      {field("domain", "Description")}{field("remarks", "Remarks")}
      <label className="company-field">PVR status<select value={draft.pvrStatus} disabled={pending} onChange={(event) => set("pvrStatus", event.target.value)}><option value="no">No</option><option value="yes">Yes</option><option value="unknown">Unknown</option></select>{result.fieldErrors?.pvrStatus && <small>{result.fieldErrors.pvrStatus}</small>}</label>
      {company && cycleCode && <p className="company-field">Earliest scheduled PPT ({cycleCode})<span>{company.visitDate ?? "Not scheduled"}</span></p>}</div>
    {!company && <section className="company-drive-section" aria-label="Drives">
      <h3>Drives</h3>
      {!drives.length && <p className="company-drive-empty">No drive added yet. Add each recruitment drive this company held, with the roles it offered.</p>}
      <DriveDraftList drafts={drives} cycles={cycles} domains={domains} pending={pending} onChange={value => { setDrives(value); setResult({}); }} />
      <div className="company-actions"><button type="button" disabled={pending || !cycles.length} onClick={() => setDrives(current => [...current, newDriveDraft(defaultCycleId)])}><Plus size={14} /> Add drive</button></div>
      {!cycles.length && <p className="company-drive-empty">No placement cycles exist yet, so drives cannot be added.</p>}
    </section>}
    {(result.error || result.fieldErrors?.form) && <p className="company-error" role="alert">{result.error || result.fieldErrors?.form}</p>}
    <div className="company-actions"><button className="dark-button" disabled={pending}>{pending ? "Saving…" : company ? "Save changes" : "Create company"}</button><button type="button" onClick={onCancel} disabled={pending}>Cancel</button></div>
  </form>;
}
