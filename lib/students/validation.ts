import { OFFER_TYPES } from "@/lib/placements/types";
import type { StudentInput, StudentOffer } from "./types";

export const rollProblem = (value: unknown): string | null =>
  (typeof value === "string" && /^[1-9][0-9]{8}$/.test(value)) ||
  (typeof value === "number" && Number.isInteger(value) && value >= 100000000 && value <= 999999999)
    ? null : "Enter exactly 9 digits, with no leading zero.";

export function offerDateProblem(offerDate: string | null | undefined, visitDate: string | null | undefined): string | null {
  return offerDate && visitDate && offerDate < visitDate
    ? "Offer date cannot be before the company's campus visit date."
    : null;
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;
const own = (value: object, key: string) => Object.hasOwn(value, key);

export function validateStudent(input: unknown, create: boolean) {
  const fieldErrors: Record<string, string> = {};
  const data: StudentInput = {};
  if (!object(input)) return { data, fieldErrors: { form: "Invalid student data." } };
  const allowed = create ? ["rollNumber", "name", "batchYear", "offer"] : ["name", "batchYear", "offer"];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) fieldErrors.form = `Field "${key}" cannot be changed.`;
  }
  if (create) {
    const problem = rollProblem(input.rollNumber);
    if (problem) fieldErrors.rollNumber = problem;
    else data.rollNumber = Number(input.rollNumber);
  }
  if (create || own(input, "name")) {
    if (typeof input.name !== "string") fieldErrors.name = "Enter a student name.";
    else {
      const name = input.name.trim().replace(/\s+/gu, " ").normalize("NFC");
      if (Array.from(name).length < 1 || Array.from(name).length > 100 ||
          !/\p{L}/u.test(name) || !/^[\p{L}\p{M} .'\u2019-]+$/u.test(name)) {
        fieldErrors.name = "Use 1–100 characters: letters, spaces, apostrophes, periods or hyphens; no digits.";
      } else data.name = name;
    }
  }
  if (create || own(input, "batchYear")) {
    const year = input.batchYear;
    if (!((typeof year === "string" && /^[1-9][0-9]{3}$/.test(year)) ||
      (typeof year === "number" && Number.isInteger(year) && year >= 1000 && year <= 9999))) {
      fieldErrors.batchYear = "Enter a four-digit graduating year.";
    } else data.batchYear = Number(year);
  }
  if (own(input, "offer")) {
    if (!object(input.offer)) fieldErrors.offer = "Invalid offer. Use Remove offer to clear it.";
    else {
      const offer: Partial<StudentOffer> = {};
      const keys = ["companyName", "jobRole", "packageLpa", "offerType", "offerDate"];
      for (const [key, value] of Object.entries(input.offer)) {
        if (!keys.includes(key)) { fieldErrors.form = `Offer field "${key}" cannot be changed.`; continue; }
        if (key === "companyName") {
          if (typeof value !== "string" || !value.trim()) fieldErrors.companyName = "Select an existing company.";
          else offer.companyName = value;
        } else if (key === "jobRole") {
          if (value !== null && typeof value !== "string") fieldErrors.jobRole = "Enter a job role or leave it blank.";
          else offer.jobRole = typeof value === "string" ? value.trim() || null : null;
        } else if (key === "packageLpa") {
          if (value === null || value === "") offer.packageLpa = null;
          else if (typeof value !== "string" || !/^\d+(\.\d+)?$/.test(value) ||
            !Number.isFinite(Number(value))) fieldErrors.packageLpa = "Enter a nonnegative decimal LPA amount, without signs or exponents.";
          else offer.packageLpa = value;
        } else if (key === "offerType") {
          if (value === "" || value === null) offer.offerType = null;
          else if (!OFFER_TYPES.includes(value as typeof OFFER_TYPES[number])) fieldErrors.offerType = "Choose PPO, FTE, FTE+6month or Not recorded.";
          else offer.offerType = value as typeof OFFER_TYPES[number];
        } else if (key === "offerDate") {
          if (value === "" || value === null) offer.offerDate = null;
          else if (typeof value !== "string" || !/^[1-9][0-9]{3}-\d{2}-\d{2}$/.test(value) ||
            !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
            fieldErrors.offerDate = "Enter a real date in YYYY-MM-DD format.";
          } else offer.offerDate = value;
        }
      }
      if (create && !offer.companyName) fieldErrors.companyName = "Select an existing company.";
      data.offer = offer;
    }
  }
  return { data, fieldErrors };
}
