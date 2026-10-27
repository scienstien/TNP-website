"use client";

import { useId, useState } from "react";
import { PROCESS_LABELS, PROCESS_TYPES } from "@/lib/calendar/labels";
import { validateEvent } from "@/lib/calendar/rules";
import type { CalendarEvent, EventInput } from "@/lib/calendar/types";
import type { DriveOption } from "@/lib/drives/types";
import { driveName, numberDuplicates, roleName } from "@/lib/drives/labels";
import NullableDateInput from "./NullableDateInput";

export default function EventForm({ event, date, drives, pending, onSave, onCancel }: { event: CalendarEvent | null; date: string; drives: DriveOption[]; pending: boolean; onSave: (input: EventInput) => void; onCancel: () => void }) {
  const id = useId();
  const [draft, setDraft] = useState<EventInput>({ driveId: event?.driveId ?? "", processType: event?.processType ?? "PPT", scheduledDate: event ? event.scheduledDate : date, scope: event?.scope ?? "WHOLE_DRIVE", label: event?.label ?? null, roleIds: event?.roles.map(role => role.roleId) ?? [] });
  const [error, setError] = useState("");
  const drive = drives.find(option => option.driveId === draft.driveId);
  return <form className="cal-form" onSubmit={submit => { submit.preventDefault(); try { const input = validateEvent(draft); setError(""); onSave(input); } catch (error) { setError(error instanceof Error ? error.message : "Invalid event."); } }}>
    <h4>{event ? "Edit drive stage" : "Add drive stage"}</h4>
    <label htmlFor={`${id}-drive`}>Drive</label><select id={`${id}-drive`} value={draft.driveId} required disabled={pending || event !== null} onChange={change => setDraft(current => ({ ...current, driveId: change.target.value, roleIds: [] }))}><option value="">Choose an existing drive</option>{numberDuplicates(drives.map(option => `${option.cycleCode} · ${option.companyName} · ${driveName(option)}`)).map((label, index) => <option key={drives[index].driveId} value={drives[index].driveId}>{label}</option>)}</select>
    {!drives.length && <p className="cal-hint">No drives available. Add one in Companies.</p>}
    <label htmlFor={`${id}-stage`}>Stage</label><select id={`${id}-stage`} value={draft.processType} disabled={pending} onChange={change => setDraft(current => ({ ...current, processType: change.target.value as EventInput["processType"] }))}>{PROCESS_TYPES.map(type => <option key={type} value={type}>{PROCESS_LABELS[type]}</option>)}</select>
    <label htmlFor={`${id}-date`}>Scheduled date (optional)</label><NullableDateInput id={`${id}-date`} value={draft.scheduledDate} disabled={pending} onChange={scheduledDate => setDraft(current => ({ ...current, scheduledDate }))} />
    <label htmlFor={`${id}-scope`}>Scope</label><select id={`${id}-scope`} value={draft.scope} disabled={pending} onChange={change => setDraft(current => ({ ...current, scope: change.target.value as EventInput["scope"], roleIds: [] }))}><option value="WHOLE_DRIVE">Whole drive</option><option value="SELECTED_ROLES">Selected roles</option></select>
    {draft.scope === "SELECTED_ROLES" && <fieldset className="cal-role-options"><legend>Select at least one role</legend>{!drive?.roles.length && <p>No roles yet. Add them in Companies.</p>}{drive && numberDuplicates(drive.roles.map(roleName)).map((label, index) => { const role = drive.roles[index]; return <label key={role.roleId}></label>; })}</fieldset>}
    <label htmlFor={`${id}-label`}>Label (optional)</label><textarea id={`${id}-label`} value={draft.label ?? ""} maxLength={200} rows={3} disabled={pending} onChange={change => setDraft(current => ({ ...current, label: change.target.value || null }))} />
    {error && <p className="cal-error" role="alert">{error}</p>}<div className="cal-form-actions"><button className="cal-primary" disabled={pending || !draft.driveId}>{pending ? "Saving…" : "Save event"}</button><button type="button" disabled={pending} onClick={onCancel}>Cancel</button></div>
  </form>;
}
