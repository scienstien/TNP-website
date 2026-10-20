"use client";

import { useState, useTransition } from "react";
import { updateCompany } from "@/lib/companies/actions";
import { validateCompanyUpdate } from "@/lib/companies/validation";
import type { CompanyRecord, CompanyResult, PvrStatus } from "@/lib/companies/types";
import "./companies.css";

type Draft = Omit<CompanyRecord, "name" | "pvrStatus" | "offerCount"> & { pvrStatus: PvrStatus };

export default function Companies({ data, isAdmin }: { data: CompanyRecord[]; isAdmin: boolean }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<CompanyRecord | null>(null);
  const [message, setMessage] = useState("");
  const visible = data.filter((company) =>
    `${company.name} ${company.domain ?? ""} ${company.hrName ?? ""} ${company.email ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  return <section className="companies-view">
    <div className="section-heading">
      <div><p className="eyebrow">DIRECTORY</p><h1>Companies</h1>
        <p>Company contacts and campus visits from the placement archive.</p></div>
    </div>
    {message && <p role="status" className="company-message">{message}</p>}
    {editing && isAdmin && <CompanyEditor company={editing} onCancel={() => setEditing(null)} onSaved={() => {
      setEditing(null); setMessage("Company changes saved.");
    }} />}
    <section className="panel company-table-panel">
      <div className="company-tools">
        <label>Search <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, sector or contact" /></label>
        <span>{visible.length} {visible.length === 1 ? "company" : "companies"}</span>
      </div>
      {!visible.length ? <p className="table-hint">{data.length ? "No companies match your search." : "No companies recorded."}</p> :
        <div className="company-table-scroll"><table className="company-table"><thead><tr>
          <th>Company</th><th>Sector</th><th>Offers</th><th>HR contact</th><th>Email</th><th>Phone</th><th>PVR</th><th>Visit date</th>{isAdmin && <th>Actions</th>}
        </tr></thead><tbody>{visible.map((company) => <tr key={company.name}>
          <td><strong>{company.name}</strong></td><td>{company.domain ?? "—"}</td><td>{company.offerCount}</td><td>{company.hrName ?? "—"}</td>
          <td>{company.email ? <a href={`mailto:${company.email}`}>{company.email}</a> : "—"}</td><td>{company.phoneNumber ?? "—"}</td>
          <td><span className={`pvr pvr-${company.pvrStatus}`}>{company.pvrStatus === "unknown" ? "Unknown" : company.pvrStatus === "yes" ? "Yes" : "No"}</span></td>
          <td>{company.visitDate ?? "Not scheduled"}</td>
          {isAdmin && <td><button type="button" onClick={() => { setEditing(company); setMessage(""); }}>Edit</button></td>}
        </tr>)}</tbody></table></div>}
    </section>
  </section>;
}

function CompanyEditor({ company, onCancel, onSaved }: { company: CompanyRecord; onCancel: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>({ domain: company.domain, hrName: company.hrName, email: company.email, phoneNumber: company.phoneNumber, pvrStatus: company.pvrStatus, visitDate: company.visitDate });
  const [result, setResult] = useState<CompanyResult>({});
  const [pending, startTransition] = useTransition();
  const set = (key: keyof Draft, value: string) => { setDraft((current) => ({ ...current, [key]: value || null })); setResult({}); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const checked = validateCompanyUpdate(draft, company.name);
    if (Object.keys(checked.fieldErrors).length) { setResult({ fieldErrors: checked.fieldErrors }); return; }
    startTransition(async () => { const saved = await updateCompany(company.name, draft); setResult(saved); if (saved.ok) onSaved(); });
  };
  const field = (key: keyof Draft, label: string, type = "text") => <label className="company-field">{label}
    <input type={type} value={draft[key] ?? ""} disabled={pending} onChange={(event) => set(key, event.target.value)} aria-invalid={Boolean(result.fieldErrors?.[key as keyof NonNullable<CompanyResult["fieldErrors"]>])} />
    {result.fieldErrors?.[key as keyof NonNullable<CompanyResult["fieldErrors"]>] && <small>{result.fieldErrors[key as keyof NonNullable<CompanyResult["fieldErrors"]>]}</small>}
  </label>;
  return <form className="panel company-editor" onSubmit={submit} noValidate><div><p className="eyebrow">EDIT COMPANY</p><h2>{company.name}</h2><p>Company names are immutable because offers reference them.</p></div>
    <div className="company-fields">{field("domain", "Sector")}{field("hrName", "HR name")}{field("email", "Email", "email")}{field("phoneNumber", "Phone", "tel")}
      <label className="company-field">PVR status<select value={draft.pvrStatus} disabled={pending} onChange={(event) => set("pvrStatus", event.target.value)}><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option></select></label>
      {field("visitDate", "Visit date", "date")}</div>
    {(result.error || result.fieldErrors?.form) && <p className="company-error" role="alert">{result.error || result.fieldErrors?.form}</p>}
    <div className="company-actions"><button className="dark-button" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button><button type="button" onClick={onCancel} disabled={pending}>Cancel</button></div>
  </form>;
}
