"use client";

import { useState, useSyncExternalStore } from "react";
import { relativeLabel, shortDate } from "@/lib/calendar/dates";
import { PROCESS_LABELS } from "@/lib/calendar/labels";
import type { CalendarEvent } from "@/lib/calendar/types";
import { UPCOMING_RANGES, upcomingCompanies, type UpcomingRange } from "@/lib/calendar/upcoming";

const STORAGE_KEY = "tnp-calendar-upcoming-range";
const DEFAULT_RANGE: UpcomingRange = 10;
const subscribeToStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};
const readStoredRange = () => { try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; } };

/** Companies coming in the next 5–30 days, from the shared drive stages. */
export default function UpcomingCompanies({ events, today, selected, onSelectDate }: { events: CalendarEvent[]; today: string; selected: string; onSelectDate: (date: string) => void }) {
  // The chosen range is a per-viewer convenience; storage may be unavailable (server render, private mode).
  const stored = useSyncExternalStore(subscribeToStorage, readStoredRange, () => null);
  const [picked, setPicked] = useState<UpcomingRange | null>(null);
  const range = picked ?? UPCOMING_RANGES.find(value => String(value) === stored) ?? DEFAULT_RANGE;
  const choose = (value: UpcomingRange) => {
    setPicked(value);
    try { window.localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* not persisted */ }
  };
  const summary = upcomingCompanies(events, today, range);
  const count = summary.companies.length;

  return <details className="cal-collapsible cal-up" open>
    <summary><span>Upcoming companies</span><span className="cal-count" aria-label={`${count} ${count === 1 ? "company" : "companies"} in the next ${range} days`}>{count}</span></summary>
    <div className="cal-range" role="radiogroup" aria-label="Show companies coming in the next">
      {UPCOMING_RANGES.map(value => <button key={value} type="button" role="radio" aria-checked={range === value} aria-label={`Next ${value} days`} onClick={() => choose(value)}>{value}d</button>)}
    </div>

    <div className="cal-up-summary">
      <strong>{count}</strong>
      <span><b>{count === 1 ? "company" : "companies"} in the next {range} days</b><small>{summary.stageCount} {summary.stageCount === 1 ? "stage" : "stages"} · {shortDate(summary.startsOn)} – {shortDate(summary.endsOn)}</small></span>
    </div>

    {!count ? <p className="cal-empty">No companies are scheduled in the next {range} days.</p>
      : <ul className="cal-list">{summary.companies.map(company => {
        const [first, ...rest] = company.events;
        const date = first.scheduledDate!;
        const when = relativeLabel(date, today);
        const nextStages = rest.slice(0, 3).map(event => `${PROCESS_LABELS[event.processType]} ${shortDate(event.scheduledDate!)}`);
        return <li key={company.companyId}>
          <button type="button" className={`cal-upcoming${date === selected ? " is-selected" : ""}`} onClick={() => onSelectDate(date)} aria-label={`${company.companyName}, ${PROCESS_LABELS[first.processType]} ${when.toLowerCase()}, ${shortDate(date)}. Show this day.`}>
            <span className="cal-datebox"><b>{Number(date.slice(8))}</b><small>{shortDate(date).split(" ")[1]}</small></span>
            <span className="cal-upcoming-text">
              <strong>{company.companyName}</strong>
              <small>{PROCESS_LABELS[first.processType]}{first.driveReference ? ` · ${first.driveReference}` : ""}</small>
              {rest.length > 0 && <small className="cal-up-next">Then {nextStages.join(", ")}{rest.length > 3 ? ` +${rest.length - 3} more` : ""}</small>}
            </span>
            <span className={`cal-badge ${when === "Today" ? "cal-badge--today" : "cal-badge--upcoming"}`}>{when}</span>
          </button>
        </li>;
      })}</ul>}
  </details>;
}
