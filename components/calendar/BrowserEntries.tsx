"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { EVENT_STORAGE_PREFIX, parseEvents } from "@/lib/calendar/local-entries";

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("mme-process-calendar-events-change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("mme-process-calendar-events-change", callback); };
};

export default function BrowserEntries({ scope }: { scope: string }) {
  const getSnapshot = useCallback(() => { try { return window.localStorage.getItem(`${EVENT_STORAGE_PREFIX}${scope}`) ?? "[]"; } catch { return "[]"; } }, [scope]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => "[]");
  const entries = useMemo(() => parseEvents(raw), [raw]);
  const download = () => {
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `browser-calendar-${scope}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="cal-browser-entries"><h2>Browser-only entries (not saved to the database)</h2><p>Read-only entries for {scope} in this browser. They have not been imported and remain in browser storage.</p><button type="button" onClick={download}>Download JSON</button>
    {!entries.length ? <p>No recognized browser entries for this scope.</p> : <ul className="cal-list">{entries.map((entry, index) => <li className="cal-card" key={`${entry.id}:${index}`}><strong>{entry.company} · {entry.stage}</strong><p>{entry.date}</p>{entry.notes && <p>{entry.notes}</p>}</li>)}</ul>}
  </section>;
}
