"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { relativeLabel, toIsoDate } from "@/lib/calendar/dates";
import { PROCESS_LABELS } from "@/lib/calendar/labels";
import { createEvent, updateEvent, deleteEvent } from "@/lib/calendar/actions";
import type { CalendarEvent, CalendarWindow, EventInput, EventResult } from "@/lib/calendar/types";
import type { DriveOption } from "@/lib/drives/types";
import { numberDuplicates, roleName } from "@/lib/drives/labels";
import EventForm from "./EventForm";
import UpcomingCompanies from "./UpcomingCompanies";
import "./calendar.css";

interface Props { today: string; initialDay: string | null; canEdit: boolean; scope: string; window: CalendarWindow; events: CalendarEvent[]; upcoming: CalendarEvent[]; drives: DriveOption[] }
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function DriveCalendar({ today, initialDay, canEdit, window: visibleWindow, events, upcoming, drives }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialDay ?? (today >= visibleWindow.startsOn && today <= visibleWindow.endsOn ? today : visibleWindow.startsOn));
  const dayHeadRef = useRef<HTMLDivElement>(null);
  /** Select a date; a date in another month loads that month with the date selected. */
  const goTo = (date: string) => {
    if (date >= visibleWindow.startsOn && date <= visibleWindow.endsOn) {
      setSelected(date);
      dayHeadRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else router.push(`/calendar?month=${date.slice(0, 7)}&day=${date}`);
  };
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [year, month] = visibleWindow.startsOn.split("-").map(Number);
  const monthLabel = new Date(`${visibleWindow.startsOn}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const blanks = (new Date(`${visibleWindow.startsOn}T00:00:00Z`).getUTCDay() + 6) % 7;
  const days = Number(visibleWindow.endsOn.slice(-2));
  const changeMonth = (offset: number) => {
    const next = new Date(Date.UTC(year, month - 1 + offset, 1));
    if (next.getUTCFullYear() < 1000 || next.getUTCFullYear() > 9999) return;
    router.push(`/calendar?month=${toIsoDate(next.getUTCFullYear(), next.getUTCMonth(), 1).slice(0, 7)}`);
  };
  const run = (action: () => Promise<EventResult>, close = false) => startTransition(async () => {
    setMessage("");
    try { const result = await action(); setMessage(result.error ?? "Event saved to the database."); if (result.ok) { if (close) setEditing(null); router.refresh(); } }
    catch { setMessage("Unable to save. Your draft is unchanged; please retry."); }
  });
  const save = (input: EventInput) => run(() => editing && editing !== "new" ? updateEvent(editing.eventId, input, JSON.stringify(editing)) : createEvent(input), true);
  const renderEvent = (event: CalendarEvent) => <li className="cal-card" key={event.eventId}><div className="cal-card-top"><strong>{event.companyName}</strong><span className="cal-stage">{PROCESS_LABELS[event.processType]}</span></div>
    <p className="cal-process-notes">{event.cycleCode}, {event.driveReference ?? "No drive reference"}</p>
    <p className="cal-process-notes">{event.scheduledDate ?? "Unscheduled"}, {event.scope === "WHOLE_DRIVE" ? "Whole drive" : "Selected roles"}</p>
    {event.roles.length > 0 && <ul className="cal-selected-roles">{numberDuplicates(event.roles.map(roleName)).map((label, index) => <li key={event.roles[index].roleId}>{label}</li>)}</ul>}
    {event.label && <p className="cal-process-notes">{event.label}</p>}
    {canEdit && <div className="cal-actions"><button type="button" disabled={pending || editing !== null} onClick={() => setEditing(event)}>Edit</button><button type="button" disabled={pending || editing !== null} onClick={() => { if (window.confirm("Delete this drive-stage event and its role links?")) run(() => deleteEvent(event.eventId, JSON.stringify(event))); }}>Delete</button></div>}
  </li>;
  const dated = events.filter(event => event.scheduledDate === selected);
  const undated = events.filter(event => event.scheduledDate === null);
  return <div className="cal-container">
    {message && <p className="cal-feedback" role="status">{message}</p>}
    <section className="cal"><div className="cal-month panel"><div className="cal-toolbar"><div><h2>{monthLabel}</h2><p className="cal-local-note">Scheduled drive stages</p></div><div className="cal-nav"><button type="button" aria-label="Previous month" disabled={pending || editing !== null} onClick={() => changeMonth(-1)}>‹</button><button type="button" disabled={pending || editing !== null} onClick={() => router.push(`/calendar?month=${today.slice(0, 7)}`)}>Today</button><button type="button" aria-label="Next month" disabled={pending || editing !== null} onClick={() => changeMonth(1)}>›</button></div></div>
      <div className="cal-weekdays">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div><div className="cal-days" aria-label={monthLabel}>
        {Array.from({ length: blanks }, (_, index) => <span className="cal-blank" key={`blank-${index}`} />)}
        {Array.from({ length: days }, (_, index) => { const date = toIsoDate(year, month - 1, index + 1); const dayEvents = events.filter(event => event.scheduledDate === date); return <button type="button" className={`cal-day${date === selected ? " cal-day--selected" : ""}${date === today ? " cal-day--today" : ""}`} key={date} aria-pressed={date === selected} aria-label={`${date}, ${dayEvents.length} events`} disabled={pending || editing !== null} onClick={() => setSelected(date)}><span className="cal-num">{index + 1}</span><span className="cal-chips">{dayEvents.slice(0, 2).map(event => <span className="cal-chip" key={event.eventId}>{event.companyName}, {PROCESS_LABELS[event.processType]}</span>)}{dayEvents.length > 2 && <span className="cal-more">+{dayEvents.length - 2} more</span>}</span>{dayEvents.length > 0 && <span className="cal-dot" aria-hidden="true" />}</button>; })}
      </div></div>
      <aside className="cal-side panel"><div className="cal-day-head" ref={dayHeadRef}><div><p className="cal-hint">{relativeLabel(selected, today)}</p><h3>{selected}</h3></div>{canEdit && !editing && <button type="button" className="cal-primary" disabled={pending} onClick={() => setEditing("new")}>+ Add stage</button>}</div>
        {editing && canEdit && <EventForm key={editing === "new" ? "new" : editing.eventId} event={editing === "new" ? null : editing} date={selected} drives={drives} pending={pending} onSave={save} onCancel={() => setEditing(null)} />}
        {!dated.length && <p className="cal-empty">No drive stages scheduled for this day.</p>}<ul className="cal-list">{dated.map(renderEvent)}</ul>
        <UpcomingCompanies events={upcoming} today={today} selected={selected} onSelectDate={date => { if (!pending && editing === null) goTo(date); }} />
        <details className="cal-collapsible cal-unscheduled">
          <summary><span>Unscheduled</span><span className="cal-count">{undated.length}</span></summary>
          <p className="cal-hint">All undated events, across cycles.</p>{!undated.length && <p className="cal-empty">No unscheduled events.</p>}<ul className="cal-list">{undated.map(renderEvent)}</ul>
        </details>
        {!canEdit && <p className="cal-hint">Only administrators with a department chosen can edit institute-wide drive stages.</p>}
      </aside>
    </section>
  </div>;
}
