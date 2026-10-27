"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createOutreachContact,
  deleteOutreachContact,
  updateOutreachContact,
} from "@/lib/outreach/actions";
import type {
  OutreachPvrStatus,
  OutreachRecord,
  OutreachResult,
} from "@/lib/outreach/types";
import { validateOutreach } from "@/lib/outreach/validation";
import "./outreach.css";

type Editing = OutreachRecord | "new" | null;

export default function OutreachTracker({
  data,
  isAdmin,
  canManage,
}: {
  data: OutreachRecord[];
  isAdmin: boolean;
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const visible = data.filter((entry) =>
    `${entry.companyName} ${entry.hrName ?? ""} ${entry.email ?? ""} ${entry.phoneNumber ?? ""} ${entry.remarks ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  const chooseDepartment = () => {
    setMessage("Select a department above to manage contacts.");
    const selector = document.querySelector<HTMLSelectElement>(
      '.dept-navbar select[aria-label="Department"]',
    );
    selector?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    selector?.focus();
    try {
      selector?.showPicker();
    } catch {
      // Focus and the inline message still point to the department selector.
    }
  };

  const remove = (entry: OutreachRecord) => {
    if (!window.confirm(`Delete the outreach entry for ${entry.companyName}?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteOutreachContact(entry.id);
      setMessage(result.ok ? "Outreach entry deleted." : result.error ?? "Unable to delete entry.");
      if (result.ok) router.refresh();
    });
  };

  return (
    <section className="outreach-view">
      <div className="section-heading">
        <div>
          <h1>Outreach</h1>
          {!isAdmin && <p id="outreach-access-note" className="outreach-access-note">
            {canManage ? "Select a department to edit contacts." : "Read only."}
          </p>}
        </div>
        {canManage && (
          <button
            className="dark-button"
            disabled={pending || editing !== null}
            aria-describedby={!isAdmin ? "outreach-access-note" : undefined}
            onClick={() => {
              if (!isAdmin) return chooseDepartment();
              setEditing("new");
              setMessage("");
            }}
          >
            Add contact
          </button>
        )}
      </div>

      {message && <p className="outreach-message" role="status">{message}</p>}
      {editing && isAdmin && (
        <OutreachEditor
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setMessage("Outreach entry saved.");
          }}
        />
      )}

      <section className="panel outreach-panel">
        <div className="outreach-tools">
          <label htmlFor="outreach-search">Search</label>
          <input
            id="outreach-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Company, HR name, email or remark"
          />
          <span>{visible.length} {visible.length === 1 ? "contact" : "contacts"}</span>
        </div>
        {visible.length === 0 ? (
          <p className="outreach-empty" role="status">
            {data.length ? "No contacts match your search." : "No outreach contacts yet."}
          </p>
        ) : (
          <div className="outreach-list">
            {visible.map((entry) => (
              <article className="outreach-card" key={entry.id}>
                <div className="outreach-card-heading">
                  <div>
                    <span className={`outreach-pvr outreach-pvr--${entry.pvrStatus}`}>
                      PVR {entry.pvrStatus === "yes" ? "Yes" : "No"}
                    </span>
                    <h2>{entry.companyName}</h2>
                  </div>
                  {canManage && (
                    <div className="outreach-actions">
                      <button disabled={pending || editing !== null} aria-describedby={!isAdmin ? "outreach-access-note" : undefined} onClick={() => isAdmin ? setEditing(entry) : chooseDepartment()}>Edit</button>
                      <button disabled={pending || editing !== null} aria-describedby={!isAdmin ? "outreach-access-note" : undefined} onClick={() => isAdmin ? remove(entry) : chooseDepartment()}>Delete</button>
                    </div>
                  )}
                </div>
                <dl className="outreach-details">
                  <div><dt>HR name</dt><dd>{entry.hrName ?? "Not recorded"}</dd></div>
                  <div><dt>Contact number</dt><dd>{entry.phoneNumber ? <a href={`tel:${entry.phoneNumber}`}>{entry.phoneNumber}</a> : "Not recorded"}</dd></div>
                  <div><dt>Email</dt><dd>{entry.email ? <a href={`mailto:${entry.email}`}>{entry.email}</a> : "Not recorded"}</dd></div>
                  <div className="outreach-remarks"><dt>Remarks</dt><dd>{entry.remarks ?? "No remarks"}</dd></div>
                  <div><dt>Last updated</dt><dd>{formatUpdatedAt(entry.updatedAt)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function OutreachEditor({
  initial,
  onCancel,
  onSaved,
}: {
  initial: OutreachRecord | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    companyName: initial?.companyName ?? "",
    hrName: initial?.hrName ?? "",
    phoneNumber: initial?.phoneNumber ?? "",
    email: initial?.email ?? "",
    pvrStatus: (initial?.pvrStatus ?? "no") as OutreachPvrStatus,
    remarks: initial?.remarks ?? "",
  });
  const [result, setResult] = useState<OutreachResult>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const set = (key: keyof typeof draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setResult({});
  };
  const error = (key: keyof NonNullable<OutreachResult["fieldErrors"]>) =>
    result.fieldErrors?.[key];

  return (
    <form
      className="panel outreach-editor"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const checked = validateOutreach(draft);
        if (Object.keys(checked.fieldErrors).length) {
          setResult({ fieldErrors: checked.fieldErrors });
          return;
        }
        startTransition(async () => {
          const saved = initial
            ? await updateOutreachContact(initial.id, draft)
            : await createOutreachContact(draft);
          setResult(saved);
          if (saved.ok) {
            router.refresh();
            onSaved();
          }
        });
      }}
    >
      <div>
        <p className="eyebrow">{initial ? "EDIT CONTACT" : "NEW CONTACT"}</p>
        <h2>{initial ? initial.companyName : "Add outreach contact"}</h2>
      </div>
      <div className="outreach-fields">
        <Field label="Company name" error={error("companyName")}>
          <input value={draft.companyName} disabled={pending} onChange={(event) => set("companyName", event.target.value)} />
        </Field>
        <Field label="HR name" error={error("hrName")}>
          <input value={draft.hrName} disabled={pending} onChange={(event) => set("hrName", event.target.value)} />
        </Field>
        <Field label="Contact number" error={error("phoneNumber")}>
          <input type="tel" value={draft.phoneNumber} disabled={pending} onChange={(event) => set("phoneNumber", event.target.value)} />
        </Field>
        <Field label="Email" error={error("email")}>
          <input type="email" value={draft.email} disabled={pending} onChange={(event) => set("email", event.target.value)} />
        </Field>
        <Field label="PVR sent" error={error("pvrStatus")}>
          <select value={draft.pvrStatus} disabled={pending} onChange={(event) => set("pvrStatus", event.target.value)}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
        <Field label="Remarks" error={error("remarks")} wide>
          <textarea value={draft.remarks} disabled={pending} onChange={(event) => set("remarks", event.target.value)} rows={3} />
        </Field>
      </div>
      {(result.error || error("form")) && <p className="outreach-error" role="alert">{result.error || error("form")}</p>}
      <div className="outreach-actions">
        <button className="dark-button" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" disabled={pending} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  wide = false,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`outreach-field${wide ? " outreach-field--wide" : ""}`}>
      <span>{label}</span>
      {children}
      <small>{error}</small>
    </label>
  );
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
