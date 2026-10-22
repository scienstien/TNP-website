/** Exact former browser-entry acceptance rules, kept separate from database event validation. */
export type ProcessStage = "PPT" | "OT" | "Group Discussion" | "Resume Shortlisting" | "PI";
export interface ProcessEvent { id: string; company: string; date: string; stage: ProcessStage; notes: string }
const STAGES: ProcessStage[] = ["PPT", "OT", "Group Discussion", "Resume Shortlisting", "PI"];
export const EVENT_STORAGE_PREFIX = "mme-process-calendar-events:";

export function parseEvents(raw: string): ProcessEvent[] {
  try {
    const saved = JSON.parse(raw) as unknown;
    if (!Array.isArray(saved)) return [];
    return saved.filter((value): value is ProcessEvent => {
      if (!value || typeof value !== "object") return false;
      const event = value as Partial<ProcessEvent>;
      return Boolean(typeof event.id === "string" && typeof event.company === "string" && typeof event.date === "string" && typeof event.notes === "string" && event.stage && STAGES.includes(event.stage));
    });
  } catch { return []; }
}
