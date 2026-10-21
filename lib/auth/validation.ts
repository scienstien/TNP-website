/** Input rules shared by sign-in and sign-up. Pure functions, safe on server and client. */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128; // bounds the hashing cost per request

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * What the sign-in form accepts: a full address, or a bare username such as "superadmin" or
 * "admin123mme", which belongs to the first allowed domain (nitt.edu by default).
 */
export function loginEmail(value: unknown): string {
  const text = normalizeEmail(value);
  return text && !text.includes("@") ? `${text}@${allowedSignupDomains()[0] ?? "nitt.edu"}` : text;
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL.test(email);
}

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN)
    return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX)
    return `Use at most ${PASSWORD_MAX} characters.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Use both letters and numbers.";
  return null;
}

/** Domains allowed to create professor accounts, from ALLOWED_SIGNUP_DOMAINS (default nitt.edu). */
export function allowedSignupDomains(): string[] {
  return (process.env.ALLOWED_SIGNUP_DOMAINS ?? "nitt.edu")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedSignupEmail(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  return allowedSignupDomains().includes(domain);
}
