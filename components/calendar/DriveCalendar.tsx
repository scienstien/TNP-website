"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  deleteVisit,
  saveVisit,
  type VisitFormState,
} from "@/lib/calendar/actions";
import {
  relativeLabel,
  toIsoDate,
  todayInInstituteZone,
  visitStatus,
} from "@/lib/calendar/dates";
import type { CalendarData, CompanyVisit } from "@/lib/calendar/types";
import "./calendar.css";

interface Props {
  data: CalendarData;
  /** Today's date at the institute, from the server (avoids a hydration mismatch). */
  today: string;
  isAdmin: boolean;
}

type Tab = "day" | "upcoming";
type Editing = { mode: "add" } | { mode: "edit"; visit: CompanyVisit } | null;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 2;

const formatLong = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** Month calendar with the companies visiting each day, an Upcoming list and (admins) add / edit / delete. */
export default function DriveCalendar({
  data,
  today: serverToday,
  isAdmin,
}: Props) {
  const [today, setToday] = useState(serverToday);
  const [selected, setSelected] = useState(serverToday);
  const [cursor, setCursor] = useState(() => ({
    year: Number(serverToday.slice(0, 4)),
    month: Number(serverToday.slice(5, 7)) - 1,
  }));
  const [tab, setTab] = useState<Tab>("day");
  const [editing, setEditing] = useState<Editing>(null);

  // Keep "today" correct if the page stays open past midnight.
  useEffect(() => {
    const timer = window.setInterval(
      () => setToday(todayInInstituteZone()),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, CompanyVisit[]>();
    for (const visit of data.visits) {
      const list = map.get(visit.visitDate);
      if (list) list.push(visit);
      else map.set(visit.visitDate, [visit]);
    }
    return map;
  }, [data.visits]);

  const upcoming = useMemo(
    () => data.visits.filter((visit) => visit.visitDate >= today),
    [data.visits, today],
  );

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleString(
    "en-US",
    {
      month: "long",
      year: "numeric",
    },
  );
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const leading = (new Date(cursor.year, cursor.month, 1).getDay() + 6) % 7;

  const moveMonth = (offset: number) =>
    setCursor((current) => {
      const next = new Date(current.year, current.month + offset, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const goTo = (iso: string) => {
    setSelected(iso);
    setCursor({
      year: Number(iso.slice(0, 4)),
      month: Number(iso.slice(5, 7)) - 1,
    });
    setTab("day");
    setEditing(null);
  };

  const selectedVisits = byDate.get(selected) ?? [];

  return (
    <section className="cal" aria-label="Drive calendar">
      <div className="cal-grid-card panel">
        <div className="cal-toolbar">
          <h2 aria-live="polite">{monthLabel}</h2>
          <div className="cal-nav">
            <button type="button" onClick={() => goTo(today)}>
              Today
            </button>
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => moveMonth(1)}
            >
              ›
            </button>
          </div>
        </div>

        <div className="cal-weekdays" aria-hidden="true">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="cal-days" role="grid" aria-label={monthLabel}>
          {Array.from(
            { length: Math.ceil((leading + daysInMonth) / 7) * 7 },
            (_, index) => {
              const day = index - leading + 1;
              if (day < 1 || day > daysInMonth)
                return <div key={index} className="cal-blank" />;
              const iso = toIsoDate(cursor.year, cursor.month, day);
              const visits = byDate.get(iso) ?? [];
              const classes = [
                "cal-day",
                iso === today && "is-today",
                iso === selected && "is-selected",
                iso < today && "is-past",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  className={classes}
                  aria-selected={iso === selected}
                  aria-label={`${formatLong(iso)}${iso === today ? ", today" : ""}. ${
                    visits.length === 0
                      ? "No company visits"
                      : `${visits.length} company ${visits.length === 1 ? "visit" : "visits"}`
                  }`}
                  onClick={() => goTo(iso)}
                >
                  <span className="cal-num">{day}</span>
                  <span className="cal-chips">
                    {visits.slice(0, MAX_CHIPS).map((visit) => (
                      <span
                        key={visit.company}
                        className="cal-chip"
                        title={visit.company}
                      >
                        {visit.company}
                      </span>
                    ))}
                    {visits.length > MAX_CHIPS && (
                      <span className="cal-more">
                        +{visits.length - MAX_CHIPS} more
                      </span>
                    )}
                  </span>
                  {visits.length > 0 && (
                    <span className="cal-dot" aria-hidden="true" />
                  )}
                </button>
              );
            },
          )}
        </div>
      </div>

      <aside className="cal-side panel">
        <div className="cal-tabs" role="tablist" aria-label="Calendar lists">
          {(
            [
              ["day", "Selected day"],
              ["upcoming", `Upcoming (${upcoming.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`cal-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`cal-panel-${id}`}
              onClick={() => {
                setTab(id);
                setEditing(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "day" ? (
          <div role="tabpanel" id="cal-panel-day" aria-labelledby="cal-tab-day">
            <div className="cal-day-head">
              <div>
                <p className="eyebrow">
                  {relativeLabel(selected, today).toUpperCase()}
                </p>
                <h3>{formatLong(selected)}</h3>
              </div>
              {isAdmin && !editing && (
                <button
                  type="button"
                  className="cal-primary"
                  onClick={() => setEditing({ mode: "add" })}
                >
                  + Add company
                </button>
              )}
            </div>

            {editing && (
              <VisitForm
                key={editing.mode === "edit" ? editing.visit.company : "add"}
                mode={editing.mode}
                visit={editing.mode === "edit" ? editing.visit : undefined}
                date={selected}
                companyNames={data.companyNames}
                onDone={() => setEditing(null)}
              />
            )}

            {selectedVisits.length === 0 && !editing ? (
              <p className="cal-empty">
                No companies visiting on this day.
                {isAdmin ? " Use “Add company” to schedule one." : ""}
              </p>
            ) : (
              <ul className="cal-list">
                {selectedVisits.map((visit) => (
                  <VisitCard
                    key={visit.company}
                    visit={visit}
                    today={today}
                    isAdmin={isAdmin}
                    onEdit={() => setEditing({ mode: "edit", visit })}
                  />
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div
            role="tabpanel"
            id="cal-panel-upcoming"
            aria-labelledby="cal-tab-upcoming"
          >
            <p className="cal-hint">
              Companies visiting from today onwards. A company leaves this list
              once its date has passed.
            </p>
            {upcoming.length === 0 ? (
              <p className="cal-empty">No upcoming company visits.</p>
            ) : (
              <ul className="cal-list">
                {upcoming.map((visit) => (
                  <li key={visit.company}>
                    <button
                      type="button"
                      className="cal-upcoming"
                      onClick={() => goTo(visit.visitDate)}
                    >
                      <span className="cal-datebox">
                        <b>{visit.visitDate.slice(8)}</b>
                        <small>
                          {new Date(
                            `${visit.visitDate}T00:00:00Z`,
                          ).toLocaleString("en-US", {
                            month: "short",
                            timeZone: "UTC",
                          })}
                        </small>
                      </span>
                      <span className="cal-upcoming-text">
                        <strong>{visit.company}</strong>
                        <small>{visit.sector ?? "Sector not recorded"}</small>
                      </span>
                      <em
                        className={`cal-badge cal-badge--${visitStatus(visit.visitDate, today).toLowerCase()}`}
                      >
                        {relativeLabel(visit.visitDate, today)}
                      </em>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>
    </section>
  );
}

function VisitCard({
  visit,
  today,
  isAdmin,
  onEdit,
}: {
  visit: CompanyVisit;
  today: string;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const status = visitStatus(visit.visitDate, today);

  const remove = () =>
    startTransition(async () => {
      const result = await deleteVisit(visit.company);
      if (result.error) setError(result.error);
      else setConfirming(false);
    });

  return (
    <li className="cal-card">
      <div className="cal-card-top">
        <strong>{visit.company}</strong>
        <em className={`cal-badge cal-badge--${status.toLowerCase()}`}>
          {status}
        </em>
      </div>
      <p className="cal-sector">{visit.sector ?? "Sector not recorded"}</p>
      <dl className="cal-contact">
        <div>
          <dt>HR</dt>
          <dd>{visit.hrName ?? "Not recorded"}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{visit.phoneNumber ?? "Not recorded"}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>
            {visit.email ? (
              <a href={`mailto:${visit.email}`}>{visit.email}</a>
            ) : (
              "Not recorded"
            )}
          </dd>
        </div>
      </dl>

      {isAdmin && (
        <div className="cal-actions">
          {confirming ? (
            <>
              <span>Remove this visit from the calendar?</span>
              <button
                type="button"
                className="cal-danger"
                disabled={pending}
                onClick={remove}
              >
                {pending ? "Removing…" : "Yes, delete"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onEdit}>
                Edit
              </button>
              <button
                type="button"
                className="cal-danger-ghost"
                onClick={() => setConfirming(true)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
      {error && (
        <p className="cal-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

function VisitForm({
  mode,
  visit,
  date,
  companyNames,
  onDone,
}: {
  mode: "add" | "edit";
  visit?: CompanyVisit;
  date: string;
  companyNames: string[];
  onDone: () => void;
}) {
  const id = useId();
  const [state, action, pending] = useActionState<VisitFormState, FormData>(
    saveVisit,
    {},
  );
  const errors = state.fieldErrors ?? {};
  const v = state.values;

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="cal-form" noValidate>
      <h4>
        {mode === "edit" ? `Edit ${visit?.company}` : "Add a company visit"}
      </h4>

      <label htmlFor={`${id}-company`}>Company</label>
      <input
        id={`${id}-company`}
        name="company"
        list={`${id}-companies`}
        defaultValue={v?.company ?? visit?.company}
        readOnly={mode === "edit"}
        required
        autoComplete="off"
        placeholder="Company name"
        aria-invalid={Boolean(errors.company)}
      />
      <datalist id={`${id}-companies`}>
        {companyNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {errors.company && <p className="cal-error">{errors.company}</p>}

      <label htmlFor={`${id}-date`}>Visit date</label>
      <input
        id={`${id}-date`}
        name="visitDate"
        type="date"
        defaultValue={v?.visitDate ?? visit?.visitDate ?? date}
        required
        aria-invalid={Boolean(errors.visitDate)}
      />
      {errors.visitDate && <p className="cal-error">{errors.visitDate}</p>}

      <label htmlFor={`${id}-sector`}>Sector</label>
      <input
        id={`${id}-sector`}
        name="sector"
        defaultValue={v?.sector ?? visit?.sector ?? ""}
        placeholder="e.g. Core: steel"
      />

      <label htmlFor={`${id}-hr`}>HR contact</label>
      <input
        id={`${id}-hr`}
        name="hrName"
        defaultValue={v?.hrName ?? visit?.hrName ?? ""}
        placeholder="Name"
      />

      <label htmlFor={`${id}-phone`}>Phone</label>
      <input
        id={`${id}-phone`}
        name="phoneNumber"
        type="tel"
        defaultValue={v?.phoneNumber ?? visit?.phoneNumber ?? ""}
        placeholder="+91 …"
        aria-invalid={Boolean(errors.phoneNumber)}
      />
      {errors.phoneNumber && <p className="cal-error">{errors.phoneNumber}</p>}

      <label htmlFor={`${id}-email`}>Email</label>
      <input
        id={`${id}-email`}
        name="email"
        type="email"
        defaultValue={v?.email ?? visit?.email ?? ""}
        placeholder="hr@company.com"
        aria-invalid={Boolean(errors.email)}
      />
      {errors.email && <p className="cal-error">{errors.email}</p>}

      {state.error && (
        <p className="cal-error" role="alert">
          {state.error}
        </p>
      )}

      <div className="cal-form-actions">
        <button type="submit" className="cal-primary" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "edit"
              ? "Save changes"
              : "Add to calendar"}
        </button>
        <button type="button" onClick={onDone} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
