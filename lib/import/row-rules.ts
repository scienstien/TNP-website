import { decimal, strictDate, type CsvRow } from "./csv";
import { EXAMPLE_MARKER, TEMPLATES, type ImportKind } from "./templates";

export function normalizeRow(row: CsvRow): CsvRow {
  const values = Object.fromEntries(Object.entries(row.values).map(([key, value]) => [key, value.trim()]));
  for (const field of ["student_name", "company_name"]) {
    if (values[field] !== undefined) values[field] = values[field].replace(/\s+/gu, " ").normalize("NFC");
  }
  if (values.department_code !== undefined) values.department_code = values.department_code.toLowerCase();
  for (const field of ["drive_id", "role_id"]) if (values[field]) values[field] = values[field].toLowerCase();
  return { ...row, values };
}

export function rowProblem(kind: ImportKind, row: CsvRow): string | null {
  row = normalizeRow(row);
  if (Object.values(row.values).some(value => value.includes(EXAMPLE_MARKER))) return "Example rows cannot be imported. Replace them with verified official data.";
  if (Object.values(row.values).some(value => /^[=+@]/u.test(value))) return "Formula-like values are not accepted. Enter literal values only.";
  for (const field of TEMPLATES[kind].required) {
    if (!row.values[field].trim()) return `${field} is required.`;
  }
  if (kind === "companies" && Array.from(row.values.company_name).length > 200)
    return "company_name must contain 1–200 characters after normalization.";
  for (const field of ["starts_on", "ends_on", "offer_date"] as const) {
    const value = row.values[field];
    if (value !== undefined && value.trim() && !strictDate(value.trim())) return `${field} must be a real YYYY-MM-DD date.`;
  }
  if (kind === "cycles" && row.values.starts_on && row.values.ends_on && row.values.starts_on > row.values.ends_on)
    return "starts_on must be on or before ends_on.";
  if (kind === "students" || kind === "offers") {
    if (!/^[1-9][0-9]{8}$/.test(row.values.roll_number.trim())) return "roll_number must be exactly nine digits without a leading zero.";
  }
  if (kind === "students" || kind === "cohorts") {
    for (const field of ["graduation_year", "admission_year"] as const) {
      const value = row.values[field]?.trim();
      if (value && !/^[1-9][0-9]{3}$/.test(value)) return `${field} must be a four-digit year.`;
    }
  }
  if (kind === "students") {
    if (row.values.admission_year && Number(row.values.admission_year) > Number(row.values.graduation_year)) return "admission_year must not be after graduation_year. Review the academic years.";
    if (!["REGISTERED", "UNREGISTERED"].includes(row.values.registration_status.trim()))
      return "registration_status must be REGISTERED or UNREGISTERED.";
    const name = row.values.student_name.trim().replace(/\s+/gu, " ");
    if (Array.from(name).length > 100 || !/\p{L}/u.test(name) || !/^[\p{L}\p{M} .'’-]+$/u.test(name))
      return "student_name must contain 1–100 letters/spaces/apostrophes/periods/hyphens and no digits.";
  }
  if (kind === "offers") {
    for (const field of ["package_lpa", "monthly_stipend_inr"] as const) {
      const value = row.values[field].trim();
      if (value && !decimal(value)) return `${field} must be a nonnegative decimal amount.`;
    }
    if (row.values.role_id.trim() && !row.values.drive_id.trim()) return "role_id requires drive_id.";
    for (const field of ["drive_id", "role_id"]) {
      if (row.values[field] && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.values[field])) return `${field} must be a UUID or blank.`;
    }
    if (row.values.offer_type.trim() && !["PPO", "FTE", "FTE+6month"].includes(row.values.offer_type.trim()))
      return "offer_type must be PPO, FTE, FTE+6month, or blank.";
  }
  return null;
}

export function duplicateKey(kind: ImportKind, row: CsvRow) {
  const value = normalizeRow(row).values;
  if (kind === "cohorts") return JSON.stringify([value.department_code, value.degree_code, value.specialization, value.graduation_year]);
  if (kind === "students") return `${value.roll_number.trim()}/${value.cycle_code.trim()}`;
  if (kind === "offers") return value.roll_number.trim();
  if (kind === "companies") return value.company_name.trim().replace(/\s+/gu, " ").normalize("NFC");
  return value.cycle_code.trim();
}
