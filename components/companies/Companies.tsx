"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CalendarCheck2, ContactRound, Pencil, Search } from "lucide-react";
import { createCompany, updateCompany } from "@/lib/companies/actions";
import { validateCompanyCreate, validateCompanyUpdate } from "@/lib/companies/validation";
import type { CompanyRecord, CompanyResult, PvrStatus } from "@/lib/companies/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import "./companies.css";

type Draft = Omit<CompanyRecord, "companyId" | "name" | "pvrStatus" | "visitDate"> & { pvrStatus: PvrStatus };

export default function Companies({ data, isAdmin, cycles, cycle, canManageDrives }: { data: CompanyRecord[]; isAdmin: boolean; canManageDrives: boolean; cycles: { cycleId: string; code: string }[]; cycle: { cycleId: string; code: string } | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<CompanyRecord | "new" | null>(null);
  const [message, setMessage] = useState("");
  const visible = data.filter((company) =>
    `${company.name} ${company.domain ?? ""} ${company.hrName ?? ""} ${company.email ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  const contactCount = data.filter((company) => company.hrName || company.email || company.phoneNumber).length;
  const scheduledVisitCount = data.filter((company) => company.visitDate).length;
  return <section className="companies-view">
    <div className="section-heading">
      <div><p className="eyebrow">DIRECTORY</p><h1>Companies</h1>
        <p>Global company contacts with an optional placement-cycle projection.</p></div>
      {canManageDrives && <Link className="company-manage-drives" href="/companies/drives">Manage drives</Link>}
      {isAdmin && <button type="button" className="dark-button company-add" disabled={editing !== null} onClick={() => { setEditing("new"); setMessage(""); }}>Add company</button>}
    </div>
    <label className="company-field">Placement cycle<select value={cycle?.cycleId ?? ""} onChange={event => router.push(event.target.value ? `?cycle=${event.target.value}` : "/companies")}><option value="">Choose a cycle</option>{cycles.map(option => <option key={option.cycleId} value={option.cycleId}>{option.code}</option>)}</select></label>
    {!cycles.length && <p className="company-message">No placement cycles exist yet</p>}
    {!cycle && <p className="company-message">Choose a cycle to see its drives, offer-linked companies and earliest scheduled PPT.</p>}
    {message && <p role="status" className="company-message">{message}</p>}
    {editing && isAdmin && <CompanyEditorModal onClose={() => setEditing(null)}><CompanyEditor key={editing === "new" ? "create" : `edit:${editing.companyId}`} company={editing === "new" ? null : editing} cycleCode={cycle?.code ?? null} onCancel={() => setEditing(null)} onSaved={() => {
      setEditing(null); setMessage(editing === "new" ? "Company added." : "Company changes saved."); setQuery(""); router.refresh();
    }} /></CompanyEditorModal>}
    <section className="panel company-table-panel company-directory-card">
      <div className="company-directory-header">
        <div>
          <p className="company-table-kicker">CONTACT DIRECTORY</p>
          <h2>Company records</h2>
          <p>Contact details are shared by every department.</p>
        </div>
        <div className="company-table-stats" aria-label="Company directory summary">
          <CompanyStat label="Companies" value={data.length} icon={Building2} />
          <CompanyStat label="Contacts" value={contactCount} icon={ContactRound} tone="contacts" />
          {cycle && <CompanyStat label="Scheduled PPTs" value={scheduledVisitCount} icon={CalendarCheck2} tone="visits" />}
        </div>
      </div>
      <div className="company-tools">
        <label className="company-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search companies</span><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, sector or contact" /></label>
        <span role="status">{visible.length} {visible.length === 1 ? "company" : "companies"}</span>
      </div>
      {!visible.length ? <p className="table-hint">{data.length ? "No companies match your search." : "No companies recorded."}</p> :
        <div className="company-table-scroll"><Table className="company-table"><TableHeader><TableRow>
          <TableHead>Company</TableHead><TableHead>Sector</TableHead><TableHead>HR name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Remarks</TableHead><TableHead>PVR</TableHead>{cycle && <TableHead>Earliest scheduled PPT ({cycle.code})</TableHead>}
        </TableRow></TableHeader><TableBody>{visible.map((company) => <TableRow key={company.companyId}>
          <TableCell><div className="company-name-cell"><strong>{company.name}</strong>
            {isAdmin && <button type="button" className="company-icon-button" title={`Edit ${company.name}`} aria-label={`Edit ${company.name}`} disabled={editing !== null} onClick={() => { setEditing(company); setMessage(""); }}><Pencil size={15} /></button>}
          </div></TableCell><TableCell>{company.domain ?? "—"}</TableCell><TableCell>{company.hrName ?? "—"}</TableCell>
          <TableCell>{company.email ? <a href={`mailto:${company.email}`}>{company.email}</a> : "—"}</TableCell><TableCell>{company.phoneNumber ?? "—"}</TableCell><TableCell>{company.remarks ?? "—"}</TableCell>
          <TableCell><Badge className={`pvr pvr-${company.pvrStatus}`}>{company.pvrStatus === "unknown" ? "Unknown" : company.pvrStatus === "yes" ? "Yes" : "No"}</Badge></TableCell>
          {cycle && <TableCell>{company.visitDate ?? "Not scheduled"}</TableCell>}
        </TableRow>)}</TableBody></Table></div>}
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

function CompanyEditor({ company, cycleCode, onCancel, onSaved }: { company: CompanyRecord | null; cycleCode: string | null; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<Draft>({ domain: company?.domain ?? null, hrName: company?.hrName ?? null, email: company?.email ?? null, phoneNumber: company?.phoneNumber ?? null, remarks: company?.remarks ?? null, pvrStatus: company?.pvrStatus ?? "unknown" });
  const [result, setResult] = useState<CompanyResult>({});
  const [pending, startTransition] = useTransition();
  const set = (key: keyof Draft, value: string) => { setDraft((current) => ({ ...current, [key]: value || null })); setResult({}); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const checked = company ? validateCompanyUpdate(draft, company.name) : validateCompanyCreate({ name, ...draft });
    if (Object.keys(checked.fieldErrors).length) { setResult({ fieldErrors: checked.fieldErrors }); return; }
    startTransition(async () => {
      try {
        const saved = company ? await updateCompany(company.companyId, draft, JSON.stringify(company)) : await createCompany({ name, ...draft });
        setResult(saved);
        if (saved.ok) onSaved();
      } catch {
        setResult({ error: "Unable to save. Your draft is unchanged; please retry." });
      }
    });
  };
  const field = (key: keyof Draft, label: string, type = "text") => <label className="company-field">{label}
    <input type={type} value={draft[key] ?? ""} disabled={pending} onChange={(event) => set(key, event.target.value)} aria-invalid={Boolean(result.fieldErrors?.[key as keyof NonNullable<CompanyResult["fieldErrors"]>])} />
    {result.fieldErrors?.[key as keyof NonNullable<CompanyResult["fieldErrors"]>] && <small>{result.fieldErrors[key as keyof NonNullable<CompanyResult["fieldErrors"]>]}</small>}
  </label>;
  return <form className="panel company-editor" onSubmit={submit} noValidate><div className="company-editor-heading"><div><p className="eyebrow">{company ? "EDIT COMPANY" : "NEW COMPANY"}</p><h2 id="company-editor-title">{company?.name ?? "Add company"}</h2><p>{company ? "Company names cannot be edited here." : "Only the company name is required. Adding a company does not create a placement offer."}</p><p>Contact details are shared by every department.</p></div><button type="button" className="company-editor-close" aria-label="Close editor" onClick={onCancel} disabled={pending}>×</button></div>
    <div className="company-fields">
      {!company && <div className="company-field"><label htmlFor="company-create-name">Company name</label>
        <input id="company-create-name" autoFocus required maxLength={120} value={name} disabled={pending} onChange={(event) => { setName(event.target.value); setResult({}); }} aria-invalid={Boolean(result.fieldErrors?.name)} aria-describedby={result.fieldErrors?.name ? "company-name-error" : undefined} />
        {result.fieldErrors?.name && <small id="company-name-error" role="alert">{result.fieldErrors.name}</small>}
      </div>}
      {field("domain", "Sector")}{field("hrName", "HR name")}{field("email", "Email", "email")}{field("phoneNumber", "Phone", "tel")}{field("remarks", "Remarks")}
      <label className="company-field">PVR status<select value={draft.pvrStatus} disabled={pending} onChange={(event) => set("pvrStatus", event.target.value)}><option value="no">No</option><option value="yes">Yes</option><option value="unknown">Unknown</option></select>{result.fieldErrors?.pvrStatus && <small>{result.fieldErrors.pvrStatus}</small>}</label>
      {company && cycleCode && <p className="company-field">Earliest scheduled PPT ({cycleCode})<span>{company.visitDate ?? "Not scheduled"}</span></p>}</div>
    {(result.error || result.fieldErrors?.form) && <p className="company-error" role="alert">{result.error || result.fieldErrors?.form}</p>}
    <div className="company-actions"><button className="dark-button" disabled={pending}>{pending ? "Saving…" : company ? "Save changes" : "Create company"}</button><button type="button" onClick={onCancel} disabled={pending}>Cancel</button></div>
  </form>;
}
