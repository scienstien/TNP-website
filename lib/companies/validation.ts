import { isValidIsoDate } from "@/lib/calendar/dates";
import type { PvrStatus } from "./types";
import { validateCompany } from "@/lib/students/company-validation";

const clean = (value: string) => value.trim().replace(/\s+/gu, " ");

/** Reuse the student editor's name rules and the directory's contact validation. */
export function validateCompanyCreate(input: unknown) {
  const values = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown> : {};
  const { name, ...fields } = values;
  const identity = validateCompany({ name });
  const details = validateCompanyUpdate({ ...fields, pvrStatus: fields.pvrStatus === undefined ? "no" : fields.pvrStatus }, identity.data.name);
  const fieldErrors: Record<string, string> = { ...identity.fieldErrors, ...details.fieldErrors };
  return {
    data: { name: identity.data.name, ...details.data },
    fieldErrors,
  };
}

export function pvrStatusFromDatabase(value: boolean | null): PvrStatus {
  return value === true ? "yes" : value === false ? "no" : "unknown";
}

export function pvrStatusToDatabase(value: unknown): boolean | null {
  return value === "yes" || value === true ? true : value === "no" || value === false ? false : null;
}

/** Validates the editable company fields. The primary key is deliberately not editable. */
export function validateCompanyUpdate(input: unknown, companyName: string) {
  const fieldErrors: Record<string, string> = {};
  const data = {
    domain: null as string | null,
    hrName: null as string | null,
    email: null as string | null,
    phoneNumber: null as string | null,
    remarks: null as string | null,
    pvrStatus: null as boolean | null,
    visitDate: null as string | null,
  };
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { data, fieldErrors: { form: "Invalid company data." } };
  }
  const values = input as Record<string, unknown>;
  const allowed = ["domain", "hrName", "email", "phoneNumber", "remarks", "pvrStatus", "visitDate"];
  if (Object.keys(values).some((key) => !allowed.includes(key))) {
    fieldErrors.form = "Company name is immutable and cannot be changed.";
  }
  const text = (key: "domain" | "hrName" | "email" | "phoneNumber" | "remarks", max: number) => {
    const value = values[key];
    if (value !== undefined && value !== null && typeof value !== "string") {
      fieldErrors[key] = "Enter text or leave this field blank.";
      return;
    }
    const normalized = typeof value === "string" ? clean(value) : "";
    if (normalized.length > max) fieldErrors[key] = `Use at most ${max} characters.`;
    data[key] = normalized || null;
  };
  text("domain", 80);
  text("hrName", 100);
  text("email", 254);
  text("phoneNumber", 30);
  text("remarks", 1000);
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    fieldErrors.email = "Enter a valid email address.";
  } else if (data.email) data.email = data.email.toLowerCase();
  if (data.phoneNumber && !/^[+\d][\d\s().-]{5,}$/.test(data.phoneNumber)) {
    fieldErrors.phoneNumber = "Enter a valid phone number.";
  }
  if (values.pvrStatus !== undefined && values.pvrStatus !== null &&
      values.pvrStatus !== true && values.pvrStatus !== false &&
      !["yes", "no", "unknown"].includes(String(values.pvrStatus))) {
    fieldErrors.pvrStatus = "Choose Yes, No or Unknown.";
  }
  data.pvrStatus = pvrStatusToDatabase(values.pvrStatus);
  if (values.visitDate !== undefined && values.visitDate !== null && typeof values.visitDate !== "string") {
    fieldErrors.visitDate = "Choose a valid date or leave it blank.";
  } else {
    const visitDate = typeof values.visitDate === "string" ? values.visitDate.trim() : "";
    if (visitDate && !isValidIsoDate(visitDate)) fieldErrors.visitDate = "Choose a valid date.";
    data.visitDate = visitDate || null;
  }
  return { data, fieldErrors, companyName };
}
