"use client";

import { useId } from "react";
import { Mail, Phone, UserRound } from "lucide-react";
import type { DriveOption } from "@/lib/drives/types";
import styles from "./CompanyContactsTable.module.css";

export interface CompanyContactsTableProps {
  company: { companyId: string; name: string } | null;
  cycle: { cycleId: string; code: string } | null;
  /** The company's drives in the selected cycle (the same list the Drive process card uses). */
  drives: DriveOption[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/** Blank stored text is shown as missing rather than as an empty cell. */
const recorded = (value: string | null) => value?.trim() || null;

/**
 * HR contacts of the company's drives in the selected cycle, one entry per drive. The legacy
 * company-level contact (companies.hr_name/email/phone_number) is no longer shown here.
 */
export default function CompanyContactsTable({ company, cycle, drives, loading, error, onRetry }: CompanyContactsTableProps) {
  const headingId = useId();
  // Ignore a previous selection's drives so they never appear as the current company's.
  const options = company && cycle ? drives.filter(drive => drive.companyId === company.companyId && drive.cycleId === cycle.cycleId) : [];
  return <section className={`panel ${styles.card}`} aria-labelledby={headingId} aria-busy={loading}>
    <header className={styles.header}>
      <h2 id={headingId}>HR contacts</h2>
      <p>The HR contact recorded for each drive{cycle ? ` in ${cycle.code}` : ""}.</p>
    </header>
    {loading ? <p role="status" className={styles.state}>Loading HR contacts…</p>
      : error !== null ? <div role="alert" className={styles.error}>
        <p>HR contacts could not be loaded.{error && <> {error}</>}</p>
        <button type="button" onClick={onRetry}>Retry</button>
      </div>
      : !company ? <p className={styles.state}>Select a company to see its drives&apos; HR contacts.</p>
      : !cycle ? <p className={styles.state}>Choose a placement cycle to see the HR contacts of {company.name}&apos;s drives.</p>
      : !options.length ? <p className={styles.state}>No drives are recorded for {company.name} in {cycle.code}.</p>
      : <ul className={styles.list} aria-label={`HR contacts for ${company.name} drives in ${cycle.code}`}>
        {options.map((drive, index) => <DriveContact key={drive.driveId} drive={drive} label={drive.reference ?? (options.length > 1 ? `Drive ${index + 1}` : "Drive")} />)}
      </ul>}
  </section>;
}

function DriveContact({ drive, label }: { drive: DriveOption; label: string }) {
  const hrName = recorded(drive.hrName);
  const phone = recorded(drive.hrPhoneNumber);
  const email = recorded(drive.hrEmail);
  return <li className={styles.item}>
    <p className={styles.drive}>{label}</p>
    <dl className={styles.fields}>
      <div><dt><UserRound size={14} aria-hidden="true" /><span>HR name</span></dt><dd>{hrName ?? <NotRecorded />}</dd></div>
      <div><dt><Phone size={14} aria-hidden="true" /><span>Phone</span></dt><dd>{phone ? <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a> : <NotRecorded />}</dd></div>
      <div><dt><Mail size={14} aria-hidden="true" /><span>Email</span></dt><dd>{email ? <a href={`mailto:${email}`}>{email}</a> : <NotRecorded />}</dd></div>
    </dl>
    {!hrName && !phone && !email && <p className={styles.note}>No HR contact is recorded for this drive. Add it with Edit drives.</p>}
  </li>;
}

function NotRecorded() {
  return <span className={styles.missing}>Not recorded</span>;
}
