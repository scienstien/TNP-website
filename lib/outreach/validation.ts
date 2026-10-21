import type { OutreachPvrStatus } from "./types";

const clean = (value: string) => value.trim().replace(/\s+/gu, " ");

export function validateOutreach(input: unknown) {
  const fieldErrors: Record<string, string> = {};
  const data = {
    companyName: "",
    hrName: null as string | null,
    phoneNumber: null as string | null,
    email: null as string | null,
    pvrStatus: "no" as OutreachPvrStatus,
    remarks: null as string | null,
  };
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { data, fieldErrors: { form: "Invalid outreach entry." } };
  }

  const values = input as Record<string, unknown>;
  const allowed = [
    "companyName",
    "hrName",
    "phoneNumber",
    "email",
    "pvrStatus",
    "remarks",
  ];
  if (Object.keys(values).some((key) => !allowed.includes(key))) {
    fieldErrors.form = "Unexpected outreach fields were submitted.";
  }

  const text = (
    key: "companyName" | "hrName" | "phoneNumber" | "email" | "remarks",
    maximum: number,
  ) => {
    const value = values[key];
    if (value !== undefined && value !== null && typeof value !== "string") {
      fieldErrors[key] = "Enter text or leave this field blank.";
      return "";
    }
    const normalized = typeof value === "string" ? clean(value) : "";
    if (normalized.length > maximum) {
      fieldErrors[key] = `Use at most ${maximum} characters.`;
    }
    return normalized;
  };

  data.companyName = text("companyName", 120);
  data.hrName = text("hrName", 100) || null;
  data.phoneNumber = text("phoneNumber", 30) || null;
  data.email = text("email", 254).toLowerCase() || null;
  data.remarks = text("remarks", 1000) || null;
  if (data.companyName.length < 2) {
    fieldErrors.companyName = "Enter a company name.";
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (
    data.phoneNumber &&
    !/^[+\d][\d\s().-]{5,}$/.test(data.phoneNumber)
  ) {
    fieldErrors.phoneNumber = "Enter a valid contact number.";
  }
  if (values.pvrStatus !== "yes" && values.pvrStatus !== "no") {
    fieldErrors.pvrStatus = "Choose Yes or No.";
  } else {
    data.pvrStatus = values.pvrStatus;
  }
  return { data, fieldErrors };
}
