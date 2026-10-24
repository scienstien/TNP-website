"use client";
import { VOLUME_MODES, type VolumeMode } from "@/lib/companies/volume";
import CompanyCycleSelector from "./CompanyCycleSelector";

export default function CompanyPageHeader({ cycles, cycleId, scopeLabel, volumeMode, onVolumeModeChange }: {
  cycles: { cycleId: string; code: string }[]; cycleId: string | null; scopeLabel: string;
  volumeMode: VolumeMode; onVolumeModeChange: (mode: VolumeMode) => void;
}) {
  return <header className="page-heading"><div><p className="eyebrow">COMPANY DATA</p><h1>Companies</h1>
    <p>Offers for {scopeLabel}</p></div>
    <div className="heading-actions heading-actions--stacked">
      <CompanyCycleSelector cycles={cycles} cycleId={cycleId} />
      <label className="company-field" title="Volume = median package of all roles' offers × students taken">Volume<select value={volumeMode}
        onChange={event => onVolumeModeChange(event.target.value as VolumeMode)}>
        {VOLUME_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
      </select></label>
    </div></header>;
}
