"use client";
import CompanyPageHeader from "./CompanyPageHeader";
import CompanyPanelController, { type CompanyPanelProps } from "./CompanyPanelController";
import "./companies.css";

/** Composition only; the controller owns selection and protected loading. */
export default function Companies(props: CompanyPanelProps) {
  return <section className="companies-view">
    <CompanyPageHeader cycles={props.cycles} cycleId={props.cycle?.cycleId ?? null} scopeLabel={props.scopeLabel} />
    <CompanyPanelController key={`${props.scopeKey}:${props.cycle?.cycleId ?? "all"}`} {...props} />
  </section>;
}
