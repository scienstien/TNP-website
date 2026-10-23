"use client";

import { useId } from "react";
import type { CompanyRecord } from "@/lib/companies/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import styles from "./CompanyContactsTable.module.css";

export interface CompanyContactsTableProps {
  company: Pick<CompanyRecord, "companyId" | "name" | "hrName" | "phoneNumber" | "email"> | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/** Blank stored text is shown as missing rather than as an empty cell. */
const recorded = (value: string | null) => value?.trim() || null;

/**
 * Read-only card for a company's single GLOBAL HR contact. These values belong to the
 * company, not to a drive or cycle, so the card deliberately takes no selection props.
 */
export default function CompanyContactsTable({ company, loading, error, onRetry }: CompanyContactsTableProps) {
  const headingId = useId();
  return <section className={`panel ${styles.card}`} aria-labelledby={headingId} aria-busy={loading}>
    <header className={styles.header}>
      <h2 id={headingId}>Company contacts (global)</h2>
      <p>Company-level HR details shared by every department. They are not linked to a particular drive or placement cycle.</p>
    </header>
    {loading ? <p role="status" className={styles.state}>Loading company contacts…</p>
      : error !== null ? <div role="alert" className={styles.error}>
        <p>Company contacts could not be loaded.{error && <> {error}</>}</p>
        <button type="button" onClick={onRetry}>Retry</button>
      </div>
      : !company ? <p className={styles.state}>Select a company to see its global HR contact.</p>
      : <ContactTable company={company} />}
  </section>;
}

function ContactTable({ company }: { company: NonNullable<CompanyContactsTableProps["company"]> }) {
  const hrName = recorded(company.hrName);
  const phoneNumber = recorded(company.phoneNumber);
  const email = recorded(company.email);
  return <>
    <p className={styles.company}>{company.name}</p>
    <div className={styles.scroll} role="region" aria-label={`Global HR contact for ${company.name}`} tabIndex={0}>
      <Table className={styles.table}>
        <caption className={styles.srOnly}>Global HR contact recorded for {company.name}</caption>
        <TableHeader><TableRow>
          <TableHead scope="col">HR name</TableHead><TableHead scope="col">Contact number</TableHead><TableHead scope="col">Email</TableHead>
        </TableRow></TableHeader>
        <TableBody><TableRow>
          <TableCell>{hrName ?? <NotRecorded />}</TableCell>
          <TableCell>{phoneNumber ?? <NotRecorded />}</TableCell>
          <TableCell>{email ? <a href={`mailto:${email}`}>{email}</a> : <NotRecorded />}</TableCell>
        </TableRow></TableBody>
      </Table>
    </div>
    {!hrName && !phoneNumber && !email && <p className={styles.note}>No global HR contact is recorded for {company.name}.</p>}
  </>;
}

function NotRecorded() {
  return <span className={styles.missing}>Not recorded</span>;
}
