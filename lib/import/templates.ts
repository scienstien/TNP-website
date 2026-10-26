/** Versioned wire format shared by downloads, validation, and preparation UI. */
export const TEMPLATE_VERSION = "1";
export const MAX_FILE_BYTES = 2_000_000;
export const MAX_ROWS = 5000;
export const EXAMPLE_MARKER = "EXAMPLE_ONLY:";
export const IMPORT_KINDS = ["companies", "cycles", "cohorts", "students", "offers"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];
export type ColumnDefinition = { name: string; required: boolean; type: string; rule: string; example: string };
const column = (name: string, required: boolean, type: string, rule: string, example = ""): ColumnDefinition => ({ name, required, type, rule, example });
const academic = [
  column("department_code", true, "Catalogue code", "Existing department code; trimmed and lower-cased. Must match the selected department. No aliases are approved.", "mme"),
  column("degree_code", true, "Catalogue code", "Exact existing degree code, including punctuation and case.", "B.Tech"),
  column("specialization", false, "Text", "Required for PG. Exact existing programme specialization; blank for an unspecialized programme."),
  column("graduation_year", true, "Integer", "Four digits, 1000–9999. Explicit cohort year; does not identify a placement cycle.", "2027"),
];
const cycle = column("cycle_code", true, "Text", "Exact placement_cycles.code. Must already exist except in the cycles template.", "EXAMPLE-CYCLE");
const roll = column("roll_number", true, "Integer", "Exactly nine digits, 100000000–999999999. Stable, immutable enrollment key.", "987654321");
function template(title: string, order: number, key: string, fields: ColumnDefinition[], description: string) {
  return { title, order, key, fields, columns: fields.map(f => f.name), required: fields.filter(f => f.required).map(f => f.name), description };
}
export const TEMPLATES = {
  companies: template("Companies", 1, "company_name", [
    column("company_name", true, "Text", "1–200 characters. Exact canonical name after whitespace/NFC normalization. Case/space variants of existing names are rejected for review, never merged.", "Example Manufacturing Ltd"),
    column("description", false, "Text", "Stored as companies.domain; descriptive only, never an analytics field.", "Fictional description"),
    column("remarks", false, "Text", "Optional company remarks.", "Fictional example"),
  ], "Institute-wide company master. Existing exact names update description and remarks; blank cells clear those fields. Legacy HR and PVR fields are preserved."),
  cycles: template("Placement cycles", 2, "cycle_code", [
    cycle,
    column("starts_on", false, "ISO date", "Real YYYY-MM-DD, or blank. Dates may overlap other cycles.", "2026-08-01"),
    column("ends_on", false, "ISO date", "Real YYYY-MM-DD, or blank. Must not precede starts_on when both exist.", "2027-06-30"),
  ], "Institute-wide cycles. Existing exact codes update optional dates; blank cells clear dates. Membership is never inferred from dates."),
  cohorts: template("Graduating cohorts", 3, "department_code + degree_code + specialization + graduation_year", academic,
    "Creates a cohort only for an existing approved programme. Existing exact combinations are skipped. Programme/degree catalogues are maintained separately."),
  students: template("Students and cycle registration", 4, "roll_number + cycle_code", [
    roll,
    column("student_name", true, "Text", "1–100 Unicode letters/marks, spaces, apostrophes, periods or hyphens; at least one letter. Whitespace/NFC normalized.", "Example Student"),
    ...academic,
    column("admission_year", false, "Integer", "Four digits, 1000–9999, or blank. Historical values are preserved.", "2023"),
    column("gender_code", false, "Catalogue code", "Exact existing gender_types.code, or blank. No inferred classification."),
    column("reservation_category_code", false, "Catalogue code", "Exact existing reservation_categories.code, or blank. No inferred classification."),
    cycle,
    column("registration_status", true, "Enum", "Exactly REGISTERED or UNREGISTERED. Must come from the official roster; no default.", "REGISTERED"),
  ], "Programme, cohort and cycle must already exist. New rolls create a person, enrollment and participation. Existing identity/academic fields must match; only registration may change. Different rolls are never merged into one person by name."),
  offers: template("Final placement offers", 5, "roll_number", [
    roll, cycle,
    column("company_name", true, "Text", "Exact existing canonical company name after whitespace/NFC normalization.", "Example Manufacturing Ltd"),
    column("drive_id", false, "UUID", "Existing drive for this company and cycle, or blank for historical offers."),
    column("role_id", false, "UUID", "Existing role belonging to drive_id. Requires drive_id."),
    column("package_lpa", false, "Decimal", "Actual annual compensation in INR LPA; nonnegative plain decimal or blank. No signs, exponent, currency symbols or commas.", "12.5"),
    column("monthly_stipend_inr", false, "Decimal", "Actual monthly stipend in INR; nonnegative plain decimal or blank."),
    column("offer_type", false, "Enum", "Exactly PPO, FTE, FTE+6month, or blank.", "FTE"),
    column("offer_date", false, "ISO date", "Real YYYY-MM-DD, or blank. Does not determine cycle membership.", "2026-12-01"),
  ], "Requires this roll's REGISTERED participation in the selected cycle. One final offer per roll across all cycles. Identical offers are skipped; conflicting offers are errors, never overwritten."),
} satisfies Record<ImportKind, ReturnType<typeof template>>;

export const PREPARATION_RULES = [
  `Template version ${TEMPLATE_VERSION}. Upload one dataset at a time in order: companies → cycles → cohorts → students → offers.`,
  "Keep exact headers, case, order and column counts. Include optional columns even when blank. No extra metadata rows or worksheets.",
  "CSV: UTF-8, comma-separated, standard double-quote escaping. XLSX: use the worksheet named exactly after the dataset; Instructions and Examples are documentation only and never imported.",
  "Use literal text/numbers; formulas, hyperlinks, errors, merged cells and hidden data rows/columns are rejected. Enter dates as text YYYY-MM-DD.",
  "Blank optional cells mean NULL. For company/cycle updates this clears the field; review before/after values before confirming.",
  "Use existing catalogue codes from the reference workbook. No guessed department aliases, registration statuses, identities or company matches.",
  "Every upload needs a successful preview and explicit confirmation within 10 minutes. If relevant records change, preview again. Any error rolls back the whole file.",
  "Imports never delete absent records or historical years. Companies and cycles are shared institute-wide. Registration and offers are restricted to the selected department.",
  `Limit ${MAX_ROWS.toLocaleString("en-US")} data rows and 2 MB per file. Examples carry ${EXAMPLE_MARKER} and are rejected if copied to the data sheet.`,
];
export function isImportKind(value: string): value is ImportKind { return Object.hasOwn(TEMPLATES, value); }
export function templateCsv(kind: ImportKind) { return `${TEMPLATES[kind].columns.join(",")}\r\n`; }
