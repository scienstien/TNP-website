"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createEvent, deleteEvent, updateEvent } from "@/lib/calendar/actions";
import { PROCESS_LABELS, PROCESS_TYPES, type ProcessType } from "@/lib/calendar/labels";
import { validateEvent } from "@/lib/calendar/rules";
import type { CalendarEvent, EventInput } from "@/lib/calendar/types";
import type { CompanyRecord } from "@/lib/companies/types";
import { createDrive, createRole, deleteDrive, deleteRole, loadCompanyDriveOptions, loadRoleDomains, updateDrive, updateRole } from "@/lib/drives/actions";
import { MAX_DRIVE_ROLES, validateDriveHr } from "@/lib/drives/rules";
import type { DriveOption, DriveResult } from "@/lib/drives/types";

type Cycle = { cycleId: string; code: string };
interface StageDraft { processType: ProcessType; scheduledDate: string | null; label: string }
interface RoleDraft { jobTitle: string; domain: string }
interface HrDraft { hrName: string; hrEmail: string; hrPhoneNumber: string }
export interface DriveDraft extends HrDraft { key: number; cycleId: string; reference: string; roles: RoleDraft[]; stages: StageDraft[] }

let nextDraftKey = 0;
export const newDriveDraft = (cycleId: string): DriveDraft => ({ key: nextDraftKey++, cycleId, reference: "", hrName: "", hrEmail: "", hrPhoneNumber: "", roles: [{ jobTitle: "", domain: "" }], stages: [] });
/** Shape accepted by createCompany/createDrive; blank extra role rows are dropped. */
export const driveDraftInput = (draft: DriveDraft) => ({
  cycleId: draft.cycleId, reference: draft.reference.trim() || null,
  hrName: draft.hrName, hrEmail: draft.hrEmail, hrPhoneNumber: draft.hrPhoneNumber,
  roles: draft.roles.filter(role => role.jobTitle.trim()).map(role => ({ jobTitle: role.jobTitle.trim(), domain: role.domain.trim() || null })),
  stages: draft.stages.map(stage => ({ processType: stage.processType, scheduledDate: stage.scheduledDate, label: stage.label.trim() || null })),
});
const draftName = (draft: DriveDraft, index: number) => draft.reference.trim() || `New drive ${index + 1}`;
const hrProblem = (hr: HrDraft) => { try { validateDriveHr({ ...hr }); return null; } catch (error) { return error instanceof Error ? error.message : "Enter the drive's HR contact."; } };

/** First problem that blocks saving the drafted drives, or null. */
export function driveDraftProblem(drafts: DriveDraft[]): string | null {
  for (const [index, draft] of drafts.entries()) {
    if (!draft.cycleId) return `Choose a placement cycle for ${draftName(draft, index)}.`;
    const hr = hrProblem(draft);
    if (hr) return `${draftName(draft, index)}: ${hr} Every drive needs its HR name, email and phone.`;
    if (!draft.roles.some(role => role.jobTitle.trim())) return `Add at least one role with a job title to ${draftName(draft, index)}. A drive cannot be created without a role.`;
  }
  return null;
}

/** Warns before creating drives without process stages; true means go ahead. */
export function confirmDraftsWithoutStages(drafts: DriveDraft[]): boolean {
  const missing = drafts.flatMap((draft, index) => draft.stages.length ? [] : [draftName(draft, index)]);
  if (!missing.length) return true;
  return window.confirm(`No process stages added for: ${missing.join(", ")}.\n\nYou can add process dates later on the Calendar page, or here with "Edit drives" in the company's Drive process card.\n\nCreate ${missing.length === 1 && drafts.length === 1 ? "the drive" : "the drives"} anyway?`);
}

/** Role domains already in use, offered as suggestions so one field is not spelled several ways. */
export function useRoleDomains(): string[] {
  const [domains, setDomains] = useState<string[]>([]);
  useEffect(() => {
    let current = true;
    loadRoleDomains().then(values => { if (current) setDomains(values); }, () => {});
    return () => { current = false; };
  }, []);
  return domains;
}

function DomainSuggestions({ id, domains }: { id: string; domains: string[] }) {
  return <datalist id={id}>{domains.map(domain => <option key={domain} value={domain} />)}</datalist>;
}

function DriveHrFields({ value, onChange }: { value: HrDraft; onChange: (value: HrDraft) => void }) {
  const field = (key: keyof HrDraft, label: string, type: string, placeholder: string) => <label className="company-field">{label}
    <input type={type} required value={value[key]} placeholder={placeholder} onChange={event => onChange({ ...value, [key]: event.target.value })} />
  </label>;
  return <div className="company-drive-roles">
    <span>HR contact for this drive (required)</span>
    <div className="company-fields">{field("hrName", "HR name", "text", "Full name")}{field("hrEmail", "HR email", "email", "name@company.com")}{field("hrPhoneNumber", "HR phone", "tel", "+91 98765 43210")}</div>
  </div>;
}

/** Editable list of drives that do not exist yet. */
export function DriveDraftList({ drafts, cycles, domains, pending, onChange }: { drafts: DriveDraft[]; cycles: Cycle[]; domains: string[]; pending: boolean; onChange: (drafts: DriveDraft[]) => void }) {
  const domainListId = useId();
  const patch = (key: number, change: Partial<DriveDraft>) => onChange(drafts.map(draft => draft.key === key ? { ...draft, ...change } : draft));
  const patchRole = (draft: DriveDraft, roleIndex: number, change: Partial<RoleDraft>) => patch(draft.key, { roles: draft.roles.map((role, i) => i === roleIndex ? { ...role, ...change } : role) });
  const patchStage = (draft: DriveDraft, stageIndex: number, change: Partial<StageDraft>) => patch(draft.key, { stages: draft.stages.map((stage, i) => i === stageIndex ? { ...stage, ...change } : stage) });
  return <>{drafts.length > 0 && <DomainSuggestions id={domainListId} domains={domains} />}{drafts.map((draft, index) => <fieldset key={draft.key} className="company-drive-draft" disabled={pending}>
    <legend>New drive {drafts.length > 1 ? index + 1 : ""}</legend>
    <div className="company-fields">
      <label className="company-field">Placement cycle<select value={draft.cycleId} required onChange={event => patch(draft.key, { cycleId: event.target.value })}><option value="">Choose a cycle</option>{cycles.map(cycle => <option key={cycle.cycleId} value={cycle.cycleId}>{cycle.code}</option>)}</select></label>
      <label className="company-field">Drive reference (optional)<input maxLength={120} value={draft.reference} placeholder="e.g. On-campus round 1" onChange={event => patch(draft.key, { reference: event.target.value })} /></label>
    </div>
    <DriveHrFields value={draft} onChange={hr => patch(draft.key, hr)} />
    <div className="company-drive-roles">
      <span>Roles offered (at least one required)</span>
      {draft.roles.map((role, roleIndex) => <div key={roleIndex} className="company-drive-role-row">
        <input aria-label={`Role ${roleIndex + 1} job title`} required={roleIndex === 0} maxLength={120} value={role.jobTitle} placeholder="Job title, e.g. Supply Engineer" onChange={event => patchRole(draft, roleIndex, { jobTitle: event.target.value })} />
        <input aria-label={`Role ${roleIndex + 1} domain (optional)`} className="company-drive-domain" list={domainListId} maxLength={80} value={role.domain} placeholder="Domain, e.g. Production" onChange={event => patchRole(draft, roleIndex, { domain: event.target.value })} />
        {draft.roles.length > 1 && <button type="button" className="company-drive-icon" aria-label={`Remove role ${roleIndex + 1}`} onClick={() => patch(draft.key, { roles: draft.roles.filter((_, i) => i !== roleIndex) })}><Trash2 size={14} /></button>}
      </div>)}
      {draft.roles.length < MAX_DRIVE_ROLES && <button type="button" className="company-drive-link" onClick={() => patch(draft.key, { roles: [...draft.roles, { jobTitle: "", domain: "" }] })}><Plus size={14} />Add role</button>}
    </div>
    <div className="company-drive-roles">
      <span>Process stages (shared by every role in this drive; shown in the process calendar)</span>
      {!draft.stages.length && <p className="company-drive-empty">No process stages yet. You can also add dates later on the Calendar page.</p>}
      {draft.stages.map((stage, stageIndex) => <div key={stageIndex} className="company-drive-role-row company-drive-stage-row">
        <select aria-label={`Stage ${stageIndex + 1}`} value={stage.processType} onChange={event => patchStage(draft, stageIndex, { processType: event.target.value as ProcessType })}>{PROCESS_TYPES.map(type => <option key={type} value={type}>{PROCESS_LABELS[type]}</option>)}</select>
        <input aria-label={`Stage ${stageIndex + 1} date (optional)`} type="date" value={stage.scheduledDate ?? ""} onChange={event => patchStage(draft, stageIndex, { scheduledDate: event.target.value || null })} />
        <input aria-label={`Stage ${stageIndex + 1} label (optional)`} maxLength={200} value={stage.label} placeholder="Label (optional), e.g. Main auditorium" onChange={event => patchStage(draft, stageIndex, { label: event.target.value })} />
        <button type="button" className="company-drive-icon" aria-label={`Remove stage ${stageIndex + 1}`} onClick={() => patch(draft.key, { stages: draft.stages.filter((_, i) => i !== stageIndex) })}><Trash2 size={14} /></button>
      </div>)}
      {draft.stages.length < 20 && <button type="button" className="company-drive-link" onClick={() => patch(draft.key, { stages: [...draft.stages, { processType: PROCESS_TYPES[draft.stages.length % PROCESS_TYPES.length], scheduledDate: null, label: "" }] })}><Plus size={14} />Add process stage</button>}
    </div>
    <button type="button" className="company-drive-remove" onClick={() => onChange(drafts.filter(item => item.key !== draft.key))}>Remove this drive</button>
  </fieldset>)}</>;
}

/** "Edit drives" in the Drive process card: new drives, and recorded drives with their HR contact, roles and process stages. */
export function CompanyDrivesEditor({ company, cycles, defaultCycleId, onClose, onChanged }: { company: Pick<CompanyRecord, "companyId" | "name">; cycles: Cycle[]; defaultCycleId: string; onClose: () => void; onChanged: () => void }) {
  const [drives, setDrives] = useState<DriveOption[] | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [drafts, setDrafts] = useState<DriveDraft[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const domains = useRoleDomains();
  const domainListId = useId();

  useEffect(() => {
    let current = true;
    loadCompanyDriveOptions(company.companyId).then(result => {
      if (!current) return;
      if (result.error) setLoadError(result.error); else { setDrives(result.drives ?? []); setEvents(result.events ?? []); setLoadError(""); }
    }, () => { if (current) setLoadError("Drives could not be loaded."); });
    return () => { current = false; };
  }, [company.companyId, loadVersion]);

  const run: Run = (action, done) => startTransition(async () => {
    setMessage("");
    try {
      const result = await action();
      if (result.ok) { setMessage("Saved."); done?.(); onChanged(); setLoadVersion(value => value + 1); }
      else setMessage(result.error ?? "Unable to save.");
    } catch { setMessage("Unable to save. Your changes are unchanged; please retry."); }
  });

  const saveDrafts = () => {
    const problem = driveDraftProblem(drafts);
    if (problem) { setMessage(problem); return; }
    if (!confirmDraftsWithoutStages(drafts)) return;
    run(async () => {
      for (const [index, draft] of drafts.entries()) {
        const result = await createDrive({ companyId: company.companyId, ...driveDraftInput(draft) });
        if (!result.ok) { setDrafts(drafts.slice(index)); return result; }
      }
      return { ok: true };
    }, () => setDrafts([]));
  };

  return <div className="panel company-editor">
    <div className="company-editor-heading"><div><p className="eyebrow">DRIVES</p><h2 id="company-editor-title">{company.name}</h2>
      <p>Manage drives, roles, HR contacts, and stages.</p></div>
      <button type="button" className="company-editor-close" aria-label="Close drives editor" onClick={onClose} disabled={pending}>×</button></div>
    {message && <p role="status" className={message === "Saved." ? "company-message" : "company-error"}>{message}</p>}

    <section className="company-drive-section" aria-label="New drives">
      <div className="company-drive-section-heading"><h3>New drives</h3>
        <button type="button" className="dark-button" disabled={pending || !cycles.length} onClick={() => setDrafts(current => [...current, newDriveDraft(defaultCycleId)])}><Plus size={14} /> Add new drive</button></div>
      {!cycles.length && <p className="company-drive-empty">No placement cycles exist yet, so drives cannot be added.</p>}
      <DriveDraftList drafts={drafts} cycles={cycles} domains={domains} pending={pending} onChange={setDrafts} />
      {drafts.length > 0 && <div className="company-actions"><button type="button" className="dark-button" disabled={pending} onClick={saveDrafts}>{pending ? "Saving…" : drafts.length === 1 ? "Save new drive" : `Save ${drafts.length} new drives`}</button><button type="button" disabled={pending} onClick={() => setDrafts([])}>Discard</button></div>}
    </section>

    <section className="company-drive-section" aria-label="Recorded drives">
      <h3>Recorded drives</h3>
      <DomainSuggestions id={domainListId} domains={domains} />
      {loadError ? <div role="alert" className="company-error">{loadError} <button type="button" onClick={() => setLoadVersion(value => value + 1)}>Retry</button></div>
        : drives === null ? <p role="status">Loading drives…</p>
        : !drives.length ? <p className="company-drive-empty">No drives recorded for {company.name} yet. Use Add new drive above.</p>
        : drives.map(drive => <RecordedDrive key={JSON.stringify(drive)} drive={drive} events={events.filter(event => event.driveId === drive.driveId)} domainListId={domainListId} pending={pending} run={run} />)}
    </section>
  </div>;
}

type Run = (action: () => Promise<DriveResult>, done?: () => void) => void;

function RecordedDrive({ drive, events, domainListId, pending, run }: { drive: DriveOption; events: CalendarEvent[]; domainListId: string; pending: boolean; run: Run }) {
  const [reference, setReference] = useState(drive.reference ?? "");
  const [hr, setHr] = useState<HrDraft>({ hrName: drive.hrName ?? "", hrEmail: drive.hrEmail ?? "", hrPhoneNumber: drive.hrPhoneNumber ?? "" });
  const [detailsError, setDetailsError] = useState("");
  const [roles, setRoles] = useState(() => Object.fromEntries(drive.roles.map(role => [role.roleId, { jobTitle: role.jobTitle ?? "", domain: role.domain ?? "" }])));
  const [newRole, setNewRole] = useState<RoleDraft>({ jobTitle: "", domain: "" });
  const snapshot = JSON.stringify(drive);
  const detailsChanged = (reference.trim() || null) !== drive.reference || hr.hrName !== (drive.hrName ?? "") || hr.hrEmail !== (drive.hrEmail ?? "") || hr.hrPhoneNumber !== (drive.hrPhoneNumber ?? "");
  const missingHr = !drive.hrName || !drive.hrEmail || !drive.hrPhoneNumber;
  const saveDetails = () => {
    const problem = hrProblem(hr);
    setDetailsError(problem ?? "");
    if (!problem) run(() => updateDrive(drive.driveId, { reference: reference.trim() || null, ...hr }, snapshot));
  };
  return <article className="company-drive-card">
    <div className="company-drive-card-heading"><strong>{drive.cycleCode}{drive.reference ? ` · ${drive.reference}` : ""}</strong>
      <button type="button" className="company-drive-remove" disabled={pending} onClick={() => { if (window.confirm("Delete this drive? A drive with roles, calendar events or offers cannot be deleted.")) run(() => deleteDrive(drive.driveId, snapshot)); }}>Delete drive</button></div>
    <fieldset className="company-drive-details" disabled={pending}>
      <label className="company-field">Drive reference (optional)<input maxLength={120} value={reference} placeholder="No reference" onChange={event => setReference(event.target.value)} /></label>
      <DriveHrFields value={hr} onChange={value => { setHr(value); setDetailsError(""); }} />
      {missingHr && !detailsChanged && <p className="company-error">This drive has no complete HR contact. Add the HR name, email and phone.</p>}
      {detailsError && <p className="company-error" role="alert">{detailsError}</p>}
      {detailsChanged && <div className="company-actions"><button type="button" className="dark-button" onClick={saveDetails}>Save drive details</button><button type="button" onClick={() => { setReference(drive.reference ?? ""); setHr({ hrName: drive.hrName ?? "", hrEmail: drive.hrEmail ?? "", hrPhoneNumber: drive.hrPhoneNumber ?? "" }); setDetailsError(""); }}>Cancel</button></div>}
    </fieldset>
    <div className="company-drive-roles">
      <span>Roles offered</span>
      {!drive.roles.length && <p className="company-drive-empty">No roles recorded. Add at least one role to this drive.</p>}
      {drive.roles.map(role => {
        const draft = roles[role.roleId] ?? { jobTitle: "", domain: "" };
        const changed = (draft.jobTitle.trim() || null) !== role.jobTitle || (draft.domain.trim() || null) !== role.domain;
        const roleSnapshot = JSON.stringify({ roleId: role.roleId, jobTitle: role.jobTitle, domain: role.domain });
        const setDraft = (change: Partial<RoleDraft>) => setRoles(current => ({ ...current, [role.roleId]: { ...draft, ...change } }));
        return <div key={role.roleId} className="company-drive-role-row">
          <input aria-label="Job title" maxLength={120} value={draft.jobTitle} placeholder="Unknown title" disabled={pending} onChange={event => setDraft({ jobTitle: event.target.value })} />
          <input aria-label="Domain" className="company-drive-domain" list={domainListId} maxLength={80} value={draft.domain} placeholder="Domain not recorded" disabled={pending} onChange={event => setDraft({ domain: event.target.value })} />
          {changed && <button type="button" disabled={pending} onClick={() => run(() => updateRole(role.roleId, { jobTitle: draft.jobTitle.trim() || null, domain: draft.domain.trim() || null }, roleSnapshot))}>Save</button>}
          <button type="button" className="company-drive-icon" aria-label={`Delete role ${role.jobTitle ?? "with unknown title"}`} title={drive.roles.length <= 1 ? "A drive needs at least one role" : undefined} disabled={pending || drive.roles.length <= 1} onClick={() => { if (window.confirm("Delete this role? A role used by calendar events or offers cannot be deleted.")) run(() => deleteRole(role.roleId, roleSnapshot)); }}><Trash2 size={14} /></button>
        </div>;
      })}
      <div className="company-drive-role-row">
        <input aria-label="New role job title" maxLength={120} value={newRole.jobTitle} placeholder="Add a role, e.g. SDE" disabled={pending} onChange={event => setNewRole(current => ({ ...current, jobTitle: event.target.value }))} />
        <input aria-label="New role domain (optional)" className="company-drive-domain" list={domainListId} maxLength={80} value={newRole.domain} placeholder="Domain, e.g. Software" disabled={pending} onChange={event => setNewRole(current => ({ ...current, domain: event.target.value }))} />
        <button type="button" disabled={pending || !newRole.jobTitle.trim()} onClick={() => run(() => createRole({ driveId: drive.driveId, jobTitle: newRole.jobTitle.trim(), domain: newRole.domain.trim() || null }), () => setNewRole({ jobTitle: "", domain: "" }))}><Plus size={14} /> Add role</button>
      </div>
    </div>
    <DriveStages drive={drive} events={events} pending={pending} run={run} />
  </article>;
}

/** The drive's process stages: the same drive_events the process calendar shows. */
function DriveStages({ drive, events, pending, run }: { drive: DriveOption; events: CalendarEvent[]; pending: boolean; run: Run }) {
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);
  const save = (input: EventInput) => run(() => editing && editing !== "new" ? updateEvent(editing.eventId, input, JSON.stringify(editing)) : createEvent(input), () => setEditing(null));
  return <div className="company-drive-roles">
    <span>Process stages (shared by every role in this drive; shown in the process calendar)</span>
    {!events.length && editing !== "new" && <p className="company-drive-empty">No process stages recorded. Add them here or on the Calendar page.</p>}
    {events.map(event => editing !== "new" && editing?.eventId === event.eventId
      ? <StageForm key={event.eventId} drive={drive} event={event} pending={pending} onSave={save} onCancel={() => setEditing(null)} />
      : <div key={event.eventId} className="company-drive-stage">
        <div><strong>{PROCESS_LABELS[event.processType]}</strong>
          <span>{event.scheduledDate ?? "Not scheduled"}</span>
          <span>{event.scope === "WHOLE_DRIVE" ? "Whole drive" : `Roles: ${event.roles.map(role => role.jobTitle ?? "Unknown title").join(", ")}`}</span>
          {event.label && <span>{event.label}</span>}</div>
        <button type="button" className="company-drive-icon" aria-label={`Edit ${PROCESS_LABELS[event.processType]} stage`} disabled={pending || editing !== null} onClick={() => setEditing(event)}><Pencil size={14} /></button>
        <button type="button" className="company-drive-icon" aria-label={`Delete ${PROCESS_LABELS[event.processType]} stage`} disabled={pending || editing !== null} onClick={() => { if (window.confirm("Delete this process stage? It is also removed from the process calendar.")) run(() => deleteEvent(event.eventId, JSON.stringify(event))); }}><Trash2 size={14} /></button>
      </div>)}
    {editing === "new" ? <StageForm drive={drive} event={null} pending={pending} onSave={save} onCancel={() => setEditing(null)} />
      : <button type="button" className="company-drive-link" disabled={pending || editing !== null} onClick={() => setEditing("new")}><Plus size={14} />Add stage</button>}
  </div>;
}

/**
 * New stages apply to the whole drive (all its roles share the process). An older stage
 * limited to selected roles keeps that scope when edited here.
 */
function StageForm({ drive, event, pending, onSave, onCancel }: { drive: DriveOption; event: CalendarEvent | null; pending: boolean; onSave: (input: EventInput) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<EventInput>({ driveId: drive.driveId, processType: event?.processType ?? "PPT", scheduledDate: event?.scheduledDate ?? null, scope: event?.scope ?? "WHOLE_DRIVE", label: event?.label ?? null, roleIds: event?.roles.map(role => role.roleId) ?? [] });
  const [error, setError] = useState("");
  const submit = () => { try { const input = validateEvent(draft); setError(""); onSave(input); } catch (failure) { setError(failure instanceof Error ? failure.message : "Invalid stage."); } };
  return <fieldset className="company-drive-draft" disabled={pending}>
    <legend>{event ? "Edit stage" : "New stage"}</legend>
    <div className="company-fields">
      <label className="company-field">Stage<select value={draft.processType} onChange={change => setDraft(current => ({ ...current, processType: change.target.value as ProcessType }))}>{PROCESS_TYPES.map(type => <option key={type} value={type}>{PROCESS_LABELS[type]}</option>)}</select></label>
      <label className="company-field">Scheduled date (optional)<input type="date" value={draft.scheduledDate ?? ""} onChange={change => setDraft(current => ({ ...current, scheduledDate: change.target.value || null }))} /></label>
      <label className="company-field">Label (optional)<input maxLength={200} value={draft.label ?? ""} onChange={change => setDraft(current => ({ ...current, label: change.target.value || null }))} /></label>
    </div>
    <p className="company-drive-empty">{draft.scope === "WHOLE_DRIVE" ? "Applies to every role in this drive." : `Applies only to: ${event?.roles.map(role => role.jobTitle ?? "Unknown title").join(", ")} (set on the Calendar page).`}</p>
    {error && <p className="company-error" role="alert">{error}</p>}
    <div className="company-actions"><button type="button" className="dark-button" onClick={submit}>{pending ? "Saving…" : "Save stage"}</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </fieldset>;
}
