"use client";

import { CalendarDays } from "lucide-react";
import { useRef } from "react";

type DatePickerProps = {
  id?: string;
  value: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
};

/** A date control backed by the browser's localized date picker. */
export function DatePicker({
  className = "",
  disabled,
  id,
  max,
  min,
  onChange,
  required,
  value,
}: DatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const openPicker = () => {
    const input = inputRef.current;
    if (!input || disabled) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  };

  return <div className={`date-picker ${className}`}>
    <input
      ref={inputRef}
      id={id}
      type="date"
      value={value}
      min={min}
      max={max}
      required={required}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
    <button type="button" className="date-picker-trigger" onClick={openPicker} disabled={disabled} aria-label="Choose date" title="Choose date">
      <CalendarDays size={16} aria-hidden="true" />
    </button>
  </div>;
}
