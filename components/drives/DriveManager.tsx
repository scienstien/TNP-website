"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createDrive, updateDrive, deleteDrive, createRole, updateRole, deleteRole } from "@/lib/drives/actions";
import type { DriveOption, DriveResult } from "@/lib/drives/types";
import "./drives.css";

interface Props {
  drives: DriveOption[];
  cycles: { cycleId: string; code: string }[];
  companies: { companyId: string; name: string }[];
  cycleId: string;
  companyId: string;
  canEdit: boolean;
}

export default function DriveManager({ drives, cycles, companies, cycleId, companyId, canEdit }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const run = (action: () => Promise<DriveResult>, done?: () => void) => startTransition(async () => {
    setMessage("");
    try { const result = await action(); setMessage(result.error ?? "Saved."); if (result.ok) { done?.(); router.refresh(); } }
    catch { setMessage("Unable to save. Your draft is unchanged; please retry."); }
  });
  const choose = (cycle: string, company: string) => {
    const params = new URLSearchParams();
    if (cycle) params.set("cycle", cycle);
    if (company) params.set("company", company);
    router.push(`/companies/drives?${params}`);
  };
  return <section className="drive-manager">
    <Link href="/companies">Back to companies</Link><h1>Historical drives and roles</h1>
    <p>Drives are shared across the institute. Company and cycle stay fixed after creation.</p>
    {!canEdit && <p>All departments is read-only. Choose a department to make changes.</p>}
    <div className="drive-filters"><label>Placement cycle<select value={cycleId} onChange={event => choose(event.target.value, companyId)}><option value="">Choose a cycle</option>{cycles.map(cycle => <option key={cycle.cycleId} value={cycle.cycleId}>{cycle.code}</option>)}</select></label>
      <label>Company<select value={companyId} onChange={event => choose(cycleId, event.target.value)}><option value="">All companies</option>{companies.map(company => <option key={company.companyId} value={company.companyId}>{company.name}</option>)}</select></label></div>
    {!cycles.length && <p>No placement cycles exist yet</p>}
    {message && <p role="status">{message}</p>}
    {canEdit && cycleId && <button type="button" disabled={pending || creating} onClick={() => setCreating(true)}>Create drive</button>}
    {creating && <CreateDriveForm key={`${cycleId}:${companyId}`} companies={companies} companyId={companyId} pending={pending} onCancel={() => setCreating(false)} onCreate={input => run(() => createDrive({ ...input, cycleId }), () => setCreating(false))} />}
    {!cycleId ? <p>Choose an existing placement cycle to view drives.</p> : !drives.length ? <p>No drives match this selection.</p> : drives.map(drive => <article className="drive-card" key={drive.driveId}>
      <h2>{drive.companyName} · {drive.reference ?? "No reference"} · {drive.driveId.slice(0, 8)}</h2><p>{drive.cycleCode} · {drive.driveId}</p>
      {canEdit && <><TextForm key={`drive:${drive.driveId}:${drive.reference}`} label="Reference" initial={drive.reference} pending={pending} onSave={reference => { if (window.confirm("Save this drive reference?")) run(() => updateDrive(drive.driveId, { reference }, JSON.stringify(drive))); }} />
        <button type="button" disabled={pending} onClick={() => { if (window.confirm("Delete this drive? Drives with roles, events or offers cannot be deleted.")) run(() => deleteDrive(drive.driveId, JSON.stringify(drive))); }}>Delete drive</button></>}
      <h3>Roles</h3>{!drive.roles.length && <p>No roles recorded.</p>}
      <ul className="drive-roles">{drive.roles.map(role => <li key={role.roleId}><strong>{role.jobTitle ?? "Unknown title"} · {role.roleId.slice(0, 8)}</strong>
        {canEdit && <><TextForm key={`${role.roleId}:${role.jobTitle}`} label="Job title" initial={role.jobTitle} pending={pending} onSave={jobTitle => { if (window.confirm("Save this role title?")) run(() => updateRole(role.roleId, { jobTitle }, JSON.stringify(role))); }} />
          <button type="button" disabled={pending} onClick={() => { if (window.confirm("Delete this role? Roles referenced by events or offers cannot be deleted.")) run(() => deleteRole(role.roleId, JSON.stringify(role))); }}>Delete role</button></>}</li>)}</ul>
      {canEdit && <TextForm label="New role title (optional)" initial={null} pending={pending} buttonLabel="Add role" onSave={jobTitle => { if (window.confirm("Add this role? Repeated and unknown titles are allowed.")) run(() => createRole({ driveId: drive.driveId, jobTitle })); }} />}
    </article>)}
  </section>;
}

function TextForm({ label, initial, pending, onSave, buttonLabel = "Save" }: { label: string; initial: string | null; pending: boolean; onSave: (value: string | null) => void; buttonLabel?: string }) {
  const [value, setValue] = useState(initial ?? "");
  return <form className="drive-text-form" onSubmit={event => { event.preventDefault(); onSave(value.trim() || null); }}><label>{label}<input value={value} maxLength={120} disabled={pending} onChange={event => setValue(event.target.value)} /></label><button disabled={pending}>{buttonLabel}</button><button type="button" disabled={pending} onClick={() => setValue(initial ?? "")}>Cancel</button></form>;
}

function CreateDriveForm({ companies, companyId, pending, onCancel, onCreate }: { companies: Props["companies"]; companyId: string; pending: boolean; onCancel: () => void; onCreate: (input: { companyId: string; reference: string | null }) => void }) {
  const [selected, setSelected] = useState(companyId);
  const [reference, setReference] = useState("");
  return <form className="drive-create-form" onSubmit={event => { event.preventDefault(); if (window.confirm("Create this historical drive? Company and cycle cannot be changed later.")) onCreate({ companyId: selected, reference: reference.trim() || null }); }}>
    <label>Company<select value={selected} required disabled={pending} onChange={event => setSelected(event.target.value)}><option value="">Choose a company</option>{companies.map(company => <option key={company.companyId} value={company.companyId}>{company.name}</option>)}</select></label>
    <label>Reference (optional)<input maxLength={120} value={reference} disabled={pending} onChange={event => setReference(event.target.value)} /></label>
    <button disabled={pending}>Create drive</button><button type="button" disabled={pending} onClick={onCancel}>Cancel</button>
  </form>;
}
