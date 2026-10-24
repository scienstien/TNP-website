import { OFFER_TYPES } from "@/lib/placements/types";

/** Rows per page of the student records list. */
export const STUDENT_PAGE_SIZE = 50;
export const STUDENT_STATUSES = ["Placed", "Unplaced", "Not registered", ...OFFER_TYPES] as const;
export type StudentStatusFilter = (typeof STUDENT_STATUSES)[number];

/** The records list's search, filters and page; every value comes from the URL and is validated here. */
export interface StudentListFilters {
  q: string;
  /** Lower-case department code; only meaningful in the cross-department view. */
  department: string | null;
  batch: number | null;
  company: string | null;
  status: StudentStatusFilter | null;
  page: number;
}

export const EMPTY_STUDENT_FILTERS: StudentListFilters = { q: "", department: null, batch: null, company: null, status: null, page: 1 };

type RawParams = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

/** Unknown or malformed values are ignored rather than trusted. */
export function parseStudentListParams(raw: RawParams): StudentListFilters {
  const department = one(raw.dept).toLowerCase();
  const batch = Number(one(raw.batch));
  const company = one(raw.company);
  const status = one(raw.status);
  const page = Number(one(raw.page));
  return {
    q: one(raw.q).slice(0, 100),
    department: /^[a-z0-9-]{1,20}$/.test(department) ? department : null,
    batch: Number.isInteger(batch) && batch >= 1000 && batch <= 9999 ? batch : null,
    company: company && company.length <= 120 ? company : null,
    status: (STUDENT_STATUSES as readonly string[]).includes(status) ? (status as StudentStatusFilter) : null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** The URL query string for the filters, leaving out defaults. Page 1 is omitted. */
export function studentListQuery(filters: StudentListFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.department) params.set("dept", filters.department);
  if (filters.batch !== null) params.set("batch", String(filters.batch));
  if (filters.company) params.set("company", filters.company);
  if (filters.status) params.set("status", filters.status);
  if (filters.page > 1) params.set("page", String(filters.page));
  const text = params.toString();
  return text ? `?${text}` : "";
}
