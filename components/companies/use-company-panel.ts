"use client";
import { useEffect, useRef, useState } from "react";

/** The key includes the server supplied scope. Older responses never replace a new selection. */
export function useCompanyPanel<T>(key: string | null, read: () => Promise<T>) {
  const reader = useRef(read);
  useEffect(() => { reader.current = read; });
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string | null; revision: number; data: T | null; error: string | null }>({ key: null, revision: 0, data: null, error: null });
  useEffect(() => {
    if (key === null) return;
    let active = true;
    reader.current().then(data => {
      if (active) setState({ key, revision, data, error: null });
    }).catch(() => {
      if (active) setState({ key, revision, data: null, error: "Unable to load these records. Refresh or retry. If this continues, ask an administrator to review the source data." });
    });
    return () => { active = false; };
  }, [key, revision]);
  const current = key !== null && state.key === key && state.revision === revision;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: key !== null && !current, retry: () => setRevision(value => value + 1) };
}
