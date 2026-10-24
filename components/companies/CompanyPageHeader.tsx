"use client";
import CompanyCycleSelector from "./CompanyCycleSelector";

export default function CompanyPageHeader({ cycles, cycleId, scopeLabel }: {
  cycles: { cycleId: string; code: string }[]; cycleId: string | null; scopeLabel: string;
}) {
  return <header className="page-heading"><div><p className="eyebrow">COMPANY DATA</p><h1>Companies</h1>
    <p>Offers for {scopeLabel}</p></div>
    <div className="heading-actions"><CompanyCycleSelector cycles={cycles} cycleId={cycleId} /></div></header>;
}
