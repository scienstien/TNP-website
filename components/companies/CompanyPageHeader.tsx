"use client";
import Link from "next/link";
import CompanyCycleSelector from "./CompanyCycleSelector";

export default function CompanyPageHeader({ cycles, cycleId, scopeLabel, canManageDrives }: {
  cycles: { cycleId: string; code: string }[]; cycleId: string | null; scopeLabel: string; canManageDrives: boolean;
}) {
  return <header className="section-heading"><div><p className="eyebrow">COMPANY DATA</p><h1>Companies</h1>
    <p>Offer totals: {scopeLabel}. Company contacts and drives are shared across departments.</p>
    <CompanyCycleSelector cycles={cycles} cycleId={cycleId} /></div>{canManageDrives && <Link href="/companies/drives">Manage drives</Link>}</header>;
}
