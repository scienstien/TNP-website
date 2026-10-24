"use client";

import { useEffect, useSyncExternalStore } from "react";

export type ProgrammeLevel = "UG" | "PG";

const STORAGE_KEY = "tnp-programme-level";
const CHANGE_EVENT = "tnp-programme-level-change";

/** The URL is authoritative while viewing a degree-specific dashboard or student page. */
export function programmeFromPath(pathname: string | null): ProgrammeLevel | null {
  if (/^\/(dashboard|students)\/pg(?:\/|$)/.test(pathname ?? "")) return "PG";
  if (/^\/(dashboard|students)\/ug(?:\/|$)/.test(pathname ?? "")) return "UG";
  return null;
}

export function programmeDestination(pathname: string | null, level: ProgrammeLevel): string {
  const section = pathname?.startsWith("/students") ? "students" : "dashboard";
  return `/${section}/${level.toLowerCase()}`;
}

function savedProgramme(): ProgrammeLevel {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "PG" ? "PG" : "UG";
  } catch {
    return "UG";
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function saveProgramme(level: ProgrammeLevel): void {
  try {
    if (window.localStorage.getItem(STORAGE_KEY) !== level) {
      window.localStorage.setItem(STORAGE_KEY, level);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  } catch {
    // The URL still carries the chosen degree when browser storage is unavailable.
  }
}

/** Keeps the top selector and sidebar aligned across dashboard and Student Records routes. */
export function useProgrammeLevel(pathname: string | null): ProgrammeLevel {
  const saved = useSyncExternalStore(subscribe, savedProgramme, (): ProgrammeLevel => "UG");
  const routeLevel = programmeFromPath(pathname);

  useEffect(() => {
    if (routeLevel) saveProgramme(routeLevel);
  }, [routeLevel]);

  return routeLevel ?? saved;
}
