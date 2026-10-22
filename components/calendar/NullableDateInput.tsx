"use client";

export default function NullableDateInput({ id, value, disabled, onChange }: { id: string; value: string | null; disabled: boolean; onChange: (value: string | null) => void }) {
  return <div className="cal-nullable-date"><input id={id} type="date" value={value ?? ""} disabled={disabled} onChange={event => onChange(event.target.value || null)} /><button type="button" disabled={disabled || value === null} onClick={() => onChange(null)}>Clear date</button><small>{value === null ? "Unscheduled" : "Optional scheduled date"}</small></div>;
}
