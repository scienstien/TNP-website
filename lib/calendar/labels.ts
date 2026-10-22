export const PROCESS_LABELS = { PPT: "PPT", OT: "OT", GD: "Group Discussion", RESUME_SHORTLISTING: "Resume Shortlisting", PI: "PI" } as const;
export type ProcessType = keyof typeof PROCESS_LABELS;
export const PROCESS_TYPES = Object.keys(PROCESS_LABELS) as ProcessType[];

export function processTypeForLabel(label: string): ProcessType | null {
  return PROCESS_TYPES.find(type => PROCESS_LABELS[type] === label) ?? null;
}
