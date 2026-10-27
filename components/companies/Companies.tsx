"use client";
import { useState } from "react";
import type { VolumeMode } from "@/lib/companies/volume";
import CompanyPageHeader from "./CompanyPageHeader";
import CompanyPanelController, { type CompanyPanelProps } from "./CompanyPanelController";
import "./companies.css";

/** Composition only; the controller owns selection and protected loading. */
export default function Companies(props: CompanyPanelProps) {
  const [volumeMode, setVolumeMode] = useState<VolumeMode>("any");
  return <section className="companies-view">
    <CompanyPageHeader cycles={props.cycles} cycleId={props.cycle?.cycleId ?? null} volumeMode={volumeMode} onVolumeModeChange={setVolumeMode} />
    <CompanyPanelController key={`${props.scopeKey}:${props.cycle?.cycleId ?? "all"}:${volumeMode}`} {...props} volumeMode={volumeMode} />
  </section>;
}
