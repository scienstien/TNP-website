import { OFFER_TYPES, REGISTRATION_STATUSES, type RegistrationStatusValue } from "@/lib/placements/types";
import type { OfferChanges, ParticipationInput, StudentDegreeLevel, StudentInput } from "./types";

/** Explicit Student Records route/action context; never derived from a year or programme label. */
export const parseStudentDegreeLevel = (value: unknown): StudentDegreeLevel | null =>
  value === "UG" || value === "ug" ? "UG" : value === "PG" || value === "pg" ? "PG" : null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A canonical (lower-case) UUID, or null. */
export const uuid = (value: unknown): string | null =>
  typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
/** A four-digit year given as a number or a digit string, or null. */
const fourDigitYear = (value: unknown): number | null =>
  (typeof value === "string" && /^[1-9][0-9]{3}$/.test(value)) ||
  (typeof value === "number" && Number.isInteger(value) && value >= 1000 && value <= 9999)
    ? Number(value) : null;

export const rollProblem = (value: unknown): string | null =>
  (typeof value === "string" && /^[1-9][0-9]{8}$/.test(value)) ||
  (typeof value === "number" && Number.isInteger(value) && value >= 100000000 && value <= 999999999)
    ? null : "Enter exactly 9 digits, with no leading zero.";

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;
const own = (value: object, key: string) => Object.hasOwn(value, key);

/** An explicit registration: a placement cycle and a chosen status. Nothing is defaulted. */
export function validateParticipation(input: unknown): { data: ParticipationInput | null; fieldErrors: Record<string, string> } {
  if (!object(input)) return { data: null, fieldErrors: { participation: "Choose a placement cycle and a registration status." } };
  const fieldErrors: Record<string, string> = {};
  if (Object.keys(input).some((key) => key !== "cycleId" && key !== "registrationStatus")) {
    fieldErrors.form = "Only the placement cycle and registration status can be set.";
  }
  const cycleId = uuid(input.cycleId);
  if (!cycleId) fieldErrors.participation = "Choose a placement cycle.";
  const status = input.registrationStatus;
  const known = REGISTRATION_STATUSES.includes(status as RegistrationStatusValue);
  if (!known) fieldErrors.registrationStatus = "Choose REGISTERED or UNREGISTERED.";
  return {
    data: cycleId && known ? { cycleId, registrationStatus: status as RegistrationStatusValue } : null,
    fieldErrors,
  };
}

export function validateStudent(input: unknown, create: boolean) {
  const fieldErrors: Record<string, string> = {};
  const data: StudentInput = {};
  if (!object(input)) return { data, fieldErrors: { form: "Invalid student data." } };
  const allowed = create
    ? ["rollNumber", "name", "genderCode", "reservationCategoryCode", "programmeId", "batchYear", "admissionYear", "participation", "offer"]
    : ["name", "genderCode", "reservationCategoryCode", "programmeId", "batchYear", "admissionYear", "offer"];
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
          !/\p{L}/u.test(name) || !/^[\p{L}\p{M} .'’-]+$/u.test(name)) {
        fieldErrors.name = "Use 1–100 characters: letters, spaces, apostrophes, periods or hyphens; no digits.";
      } else data.name = name;
    }
  }
  for (const key of ["genderCode", "reservationCategoryCode"] as const) {
    if (create || own(input, key)) {
      const value = input[key];
      if (value === undefined && !create) continue;
      if (value === undefined || value === null || value === "") data[key] = null;
      else if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
        fieldErrors[key] = "Choose an existing option or leave it blank.";
      } else data[key] = value;
    }
  }
  if (create || own(input, "programmeId")) {
    const programmeId = uuid(input.programmeId);
    if (!programmeId) fieldErrors.programmeId = "Choose a programme.";
    else data.programmeId = programmeId;
  }
  if (create || own(input, "batchYear")) {
    const year = fourDigitYear(input.batchYear);
    if (year === null) fieldErrors.batchYear = "Enter a four-digit graduating year.";
    else data.batchYear = year;
  }
  if (create || own(input, "admissionYear")) {
    const value = input.admissionYear;
    if (value === undefined || value === null || value === "") data.admissionYear = null;
    else {
      const year = fourDigitYear(value);
      if (year === null) fieldErrors.admissionYear = "Enter a four-digit admission year or leave it blank.";
      else data.admissionYear = year;
    }
  }
  if (create && own(input, "participation") && input.participation !== null) {
    const participation = validateParticipation(input.participation);
    Object.assign(fieldErrors, participation.fieldErrors);
    if (participation.data) data.participation = participation.data;
  }
  if (own(input, "offer")) {
    if (!object(input.offer)) fieldErrors.offer = "Invalid offer. Use Remove offer to clear it.";
    else {
      const offer: OfferChanges = {};
      const keys = ["cycleId", "companyId", "driveId", "roleId", "packageLpa", "offerType", "offerDate"];
      for (const [key, value] of Object.entries(input.offer)) {
        if (!keys.includes(key)) { fieldErrors.form = `Offer field "${key}" cannot be changed.`; continue; }
        if (key === "cycleId") {
          const cycleId = uuid(value);
          if (!cycleId) fieldErrors.offer = "Choose a valid placement cycle.";
          else offer.cycleId = cycleId;
        } else if (key === "companyId") {
          const companyId = uuid(value);
          if (!companyId) fieldErrors.companyId = "Select an existing company.";
          else offer.companyId = companyId;
        } else if (key === "driveId" || key === "roleId") {
          if (value === "" || value === null) offer[key] = null;
          else {
            const id = uuid(value);
            if (!id) fieldErrors[key] = key === "driveId" ? "Choose an existing drive or leave it blank." : "Choose an existing role or leave it blank.";
            else offer[key] = id;
          }
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
      if (create && !offer.companyId && !fieldErrors.companyId) fieldErrors.companyId = "Select an existing company.";
      data.offer = offer;
    }
  }
  return { data, fieldErrors };
}
