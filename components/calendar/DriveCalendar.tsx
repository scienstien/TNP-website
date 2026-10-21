"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { relativeLabel, toIsoDate } from "@/lib/calendar/dates";
import { DatePicker } from "@/components/ui/date-picker";
import "./calendar.css";

type ProcessStage =
  | "PPT"
  | "OT"
  | "Group Discussion"
  | "Resume Shortlisting"
  | "PI";

interface ProcessEvent {
  id: string;
  company: string;
  date: string;
  stage: ProcessStage;
  notes: string;
}

interface Props {
  today: string;
  isAdmin: boolean;
  /** Department code (or "all"): each department keeps its own entries in this browser. */
  scope: string;
}

type Draft = Omit<ProcessEvent, "id">;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STAGES: ProcessStage[] = [
  "PPT",
  "OT",
  "Group Discussion",
  "Resume Shortlisting",
  "PI",
];
const EVENT_STORAGE_KEY = "mme-process-calendar-events";
const EVENT_CHANGE_EVENT = "mme-process-calendar-events-change";

const subscribeToEvents = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT_CHANGE_EVENT, callback);
  };
};

const parseEvents = (raw: string): ProcessEvent[] => {
  try {
    const saved = JSON.parse(raw) as unknown;
    if (!Array.isArray(saved)) return [];
    return saved.filter((value): value is ProcessEvent => {
      if (!value || typeof value !== "object") return false;
      const event = value as Partial<ProcessEvent>;
      return Boolean(
        typeof event.id === "string" &&
        typeof event.company === "string" &&
        typeof event.date === "string" &&
        typeof event.notes === "string" &&
        event.stage && STAGES.includes(event.stage),
      );
    });
  } catch {
    return [];
  }
};

const formatLong = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export default function DriveCalendar({ today, isAdmin, scope }: Props) {
  const storageKey = `${EVENT_STORAGE_KEY}:${scope}`;
  const getStoredEvents = useCallback(
    () => window.localStorage.getItem(storageKey) ?? "[]",
    [storageKey],
  );
  const storedEvents = useSyncExternalStore(
    subscribeToEvents,
    getStoredEvents,
    () => "[]",
  );
  const events = useMemo(() => parseEvents(storedEvents), [storedEvents]);
  const [selected, setSelected] = useState(today);
  const [cursor, setCursor] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)) - 1,
  }));
  const [editing, setEditing] = useState<ProcessEvent | "new" | null>(null);

  const updateEvents = (next: ProcessEvent[]) => {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT_CHANGE_EVENT));
  };

  const byDate = useMemo(() => {
    const map = new Map<string, ProcessEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  const selectedEvents = byDate.get(selected) ?? [];
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleString(
    "en-US",
    { month: "long", year: "numeric" },
  );
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const leading = (new Date(cursor.year, cursor.month, 1).getDay() + 6) % 7;

  const moveMonth = (offset: number) => {
    const next = new Date(cursor.year, cursor.month + offset, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  const goTo = (date: string) => {
    setSelected(date);
    setCursor({
      year: Number(date.slice(0, 4)),
      month: Number(date.slice(5, 7)) - 1,
    });
    setEditing(null);
  };

  const save = (draft: Draft, id?: string) => {
    if (id) {
      updateEvents(
        events.map((event) => (event.id === id ? { ...draft, id } : event)),
      );
    } else {
      updateEvents([
        ...events,
        { ...draft, id: crypto.randomUUID() },
      ]);
    }
    goTo(draft.date);
  };

  return (
    <section className="cal" aria-label="Recruitment process calendar">
      <div className="cal-grid-card panel">
        <div className="cal-toolbar">
          <div>
            <h2 aria-live="polite">{monthLabel}</h2>
            <p className="cal-local-note">Temporary planning calendar · not saved to the database</p>
          </div>
          <div className="cal-nav">
            <button type="button" onClick={() => goTo(today)}>Today</button>
            <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>‹</button>
            <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>›</button>
          </div>
        </div>

        <div className="cal-weekdays" aria-hidden="true">
          {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="cal-days" role="grid" aria-label={monthLabel}>
          {Array.from(
            { length: Math.ceil((leading + daysInMonth) / 7) * 7 },
            (_, index) => {
              const day = index - leading + 1;
              if (day < 1 || day > daysInMonth) {
                return <div key={index} className="cal-blank" />;
              }
              const date = toIsoDate(cursor.year, cursor.month, day);
              const dayEvents = byDate.get(date) ?? [];
              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  className={[
                    "cal-day",
                    date === today && "is-today",
                    date === selected && "is-selected",
                    date < today && "is-past",
                  ].filter(Boolean).join(" ")}
                  aria-selected={date === selected}
                  aria-label={`${formatLong(date)}. ${dayEvents.length} process ${dayEvents.length === 1 ? "entry" : "entries"}`}
                  onClick={() => goTo(date)}
                >
                  <span className="cal-num">{day}</span>
                  <span className="cal-chips">
                    {dayEvents.slice(0, 2).map((event) => (
                      <span key={event.id} className="cal-chip" title={`${event.company}: ${event.stage}`}>
                        {event.company} · {event.stage}
                      </span>
                    ))}
                    {dayEvents.length > 2 && <span className="cal-more">+{dayEvents.length - 2} more</span>}
                  </span>
                  {dayEvents.length > 0 && <span className="cal-dot" aria-hidden="true" />}
                </button>
              );
            },
          )}
        </div>
      </div>

      <aside className="cal-side panel">
        <div className="cal-day-head">
          <div>
            <p className="eyebrow">{relativeLabel(selected, today).toUpperCase()}</p>
            <h3>{formatLong(selected)}</h3>
          </div>
          {isAdmin && !editing && (
            <button type="button" className="cal-primary" onClick={() => setEditing("new")}>+ Add process</button>
          )}
        </div>

        {editing && (
          <ProcessForm
            event={editing === "new" ? undefined : editing}
            selectedDate={selected}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        )}

        {!editing && selectedEvents.length === 0 && (
          <p className="cal-empty">
            No recruitment process scheduled for this day.
            {isAdmin ? " Use “Add process” to create one." : ""}
          </p>
        )}

        <ul className="cal-list">
          {selectedEvents.map((event) => (
            <li key={event.id} className="cal-card">
              <div className="cal-card-top">
                <strong>{event.company}</strong>
                <span className="cal-stage">{event.stage}</span>
              </div>
              {event.notes && <p className="cal-process-notes">{event.notes}</p>}
              {isAdmin && (
                <div className="cal-actions">
                  <button type="button" onClick={() => setEditing(event)}>Edit</button>
                  <button
                    type="button"
                    className="cal-danger-ghost"
                    onClick={() => updateEvents(events.filter((item) => item.id !== event.id))}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}

function ProcessForm({
  event,
  selectedDate,
  onSave,
  onCancel,
}: {
  event?: ProcessEvent;
  selectedDate: string;
  onSave: (draft: Draft, id?: string) => void;
  onCancel: () => void;
}) {
  const [company, setCompany] = useState(event?.company ?? "");
  const [date, setDate] = useState(event?.date ?? selectedDate);
  const [stage, setStage] = useState<ProcessStage>(event?.stage ?? "OT");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [error, setError] = useState("");

  return (
    <form
      className="cal-form"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        const normalizedCompany = company.trim();
        if (!normalizedCompany) {
          setError("Enter a company or process name.");
          return;
        }
        onSave(
          { company: normalizedCompany, date, stage, notes: notes.trim() },
          event?.id,
        );
      }}
    >
      <h4>{event ? "Update process" : "Add recruitment process"}</h4>
      <label htmlFor="process-company">Company / title</label>
      <input id="process-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" />
      <label htmlFor="process-date">Date</label>
      <DatePicker id="process-date" value={date} onChange={setDate} required />
      <label htmlFor="process-stage">Process stage</label>
      <select id="process-stage" value={stage} onChange={(e) => setStage(e.target.value as ProcessStage)}>
        {STAGES.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <label htmlFor="process-notes">Notes</label>
      <textarea id="process-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional details" />
      {error && <p className="cal-error" role="alert">{error}</p>}
      <div className="cal-form-actions">
        <button type="submit" className="cal-primary">{event ? "Save changes" : "Add to calendar"}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
