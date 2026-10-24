/** Shared validation for explicit company creation in the student editor. */
export function validateCompany(input: unknown) {
  const fieldErrors: Record<string, string> = {};
  const data = { name: "", domain: null as string | null };
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { data, fieldErrors: { form: "Invalid company data." } };
  }
  const values = input as Record<string, unknown>;
  if (Object.keys(values).some(key => key !== "name" && key !== "domain")) {
    fieldErrors.form = "Only company name and description can be set here.";
  }
  if (typeof values.name !== "string") fieldErrors.name = "Enter the company name.";
  else {
    data.name = values.name.trim().replace(/\s+/gu, " ");
    if (data.name.length < 2 || data.name.length > 120) {
      fieldErrors.name = "Enter a company name of 2–120 characters.";
    }
  }
  if (values.domain !== undefined && values.domain !== null) {
    if (typeof values.domain !== "string") fieldErrors.domain = "Enter a description or leave it blank.";
    else {
      data.domain = values.domain.trim().replace(/\s+/gu, " ") || null;
      if (data.domain && data.domain.length > 80) fieldErrors.domain = "Use at most 80 characters for the description.";
    }
  }
  return { data, fieldErrors };
}
