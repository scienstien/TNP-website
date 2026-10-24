"use client";

import type { ChangeEvent } from "react";
import { PROCESS_LABELS } from "@/lib/calendar/labels";
import type { CalendarEvent } from "@/lib/calendar/types";
import type { DriveOption } from "@/lib/drives/types";
import { driveLabels, numberDuplicates, roleName } from "@/lib/drives/labels";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import styles from "./CompanyProcessTable.module.css";

export interface CompanyProcessTableProps {
  company: { companyId: string; name: string } | null;
  cycle: { cycleId: string; code: string } | null;
  drives: DriveOption[];
  selectedDriveId: string | null;
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  onDriveChange: (driveId: string | null) => void;
  onRefresh: () => void;
  /** Present only for administrators: opens the company's drive editor. */
  onEditDrives?: () => void;
}

/** Reference, numbered "(1)", "(2)" only when several drives read the same. */
function driveLabel(drive: DriveOption, drives: DriveOption[]) {
  return driveLabels(drives)[drives.indexOf(drive)];
}

/**
 * Read-only process stages for one exact drive. Selection belongs to the caller: the card
 * never picks a drive itself, and it ignores drives/events that do not match the current
 * company, cycle and drive so a previous selection cannot appear as current.
 */
export default function CompanyProcessTable({ company, cycle, drives, selectedDriveId, events, loading, error, onDriveChange, onRefresh, onEditDrives }: CompanyProcessTableProps) {
  const options = company && cycle ? drives.filter(drive => drive.companyId === company.companyId && drive.cycleId === cycle.cycleId) : [];
  const selectedDrive = options.find(drive => drive.driveId === selectedDriveId) ?? null;
  const driveEvents = selectedDrive ? events.filter(event => event.driveId === selectedDrive.driveId) : [];
  return <section className={`panel ${styles.card}`} aria-label="Drive process" aria-busy={loading}>
    <header className={styles.header}>
      <div>
        <h2>Drive process</h2>
        <p>Scheduled stages for one exact drive, read from the shared process calendar. A scheduled date does not confirm that a stage took place.</p>
      </div>
      <div className={styles.actions}>
        {company && onEditDrives && <button type="button" className={`${styles.button} ${styles.primary}`} onClick={onEditDrives}>Edit drives</button>}
        {((company && cycle) || error !== null) && <button type="button" className={styles.button} onClick={onRefresh}>Refresh</button>}
      </div>
    </header>
    {company && cycle && <p className={styles.context}>{company.name} · {cycle.code}</p>}
    {options.length > 0 && <label className={styles.field}>Drive
      <select value={selectedDrive?.driveId ?? ""} onChange={(event: ChangeEvent<HTMLSelectElement>) => onDriveChange(event.target.value || null)}>
        <option value="">Choose a drive</option>
        {options.map(drive => <option key={drive.driveId} value={drive.driveId}>{driveLabel(drive, options)}</option>)}
      </select>
    </label>}
    {loading ? <p role="status" className={styles.state}>Loading drive process…</p>
      : error !== null ? <p role="alert" className={styles.error}>Process events could not be loaded.{error && <> {error}</>} Use Refresh to try again.</p>
      : !company || !cycle ? <p className={styles.state}>Select a company and placement cycle to see its drives.</p>
      : !options.length ? <p className={styles.state}>No drives are recorded for {company.name} in {cycle.code}.{onEditDrives && " Use Edit drives to add one."}</p>
      : !selectedDriveId ? <p className={styles.state}>Choose a drive to see its process events.</p>
      : !selectedDrive ? <p className={styles.state}>The selected drive is not available for {company.name} in {cycle.code}. Choose a drive from the list.</p>
      : !driveEvents.length ? <p className={styles.state}>No event recorded for this drive. This does not mean a stage did not happen.</p>
      : <EventTable label={driveLabel(selectedDrive, options)} events={driveEvents} />}
  </section>;
}

function EventTable({ label, events }: { label: string; events: CalendarEvent[] }) {
  return <div className={styles.scroll} role="region" aria-label={`Process events for drive ${label}`} tabIndex={0}>
    <Table className={styles.table}>
      <caption className={styles.srOnly}>Process events for drive {label}</caption>
      <TableHeader><TableRow><TableHead scope="col">Event type</TableHead><TableHead scope="col">Scheduled date</TableHead></TableRow></TableHeader>
      <TableBody>{events.map(event => <TableRow key={event.eventId}>
        <TableCell><EventDetails event={event} /></TableCell>
        <TableCell>{event.scheduledDate ? <time dateTime={event.scheduledDate}>{event.scheduledDate}</time> : <span className={styles.missing}>Not scheduled</span>}</TableCell>
      </TableRow>)}</TableBody>
    </Table>
  </div>;
}

function EventDetails({ event }: { event: CalendarEvent }) {
  return <div className={styles.event}>
    <strong>{PROCESS_LABELS[event.processType]}</strong>
    {event.label && <span className={styles.label}>{event.label}</span>}
    <span className={styles.scope}>{event.scope === "WHOLE_DRIVE" ? "Whole drive" : "Selected roles"}</span>
    {event.roles.length > 0
      ? <ul className={styles.roles} aria-label="Roles">{numberDuplicates(event.roles.map(role => roleName({ ...role, jobTitle: role.jobTitle ?? "Unknown title" }))).map((label, index) => <li key={event.roles[index].roleId}>{label}</li>)}</ul>
      : event.scope === "SELECTED_ROLES" && <span className={styles.missing}>No roles linked</span>}
  </div>;
}
