"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { hashPassword } from "./password";
import { clientIp, takeAttempt } from "./rate-limit";
import {
  allowedSignupDomains,
  isAllowedSignupEmail,
  isValidEmail,
  normalizeEmail,
  passwordProblem,
} from "./validation";

export interface AuthFormState {
  error?: string;
  fieldErrors?: Partial<
    Record<"name" | "email" | "password" | "confirmPassword", string>
  >;
  values?: { name?: string; email?: string };
}

/** Only same-site paths, so a crafted link cannot bounce users to another site after login. */
function safeRedirect(value: FormDataEntryValue | null): string {
  const target = typeof value === "string" ? value : "";
  return target.startsWith("/") &&
    !target.startsWith("//") &&
    !target.startsWith("/\\")
    ? target
    : "/";
}

async function signInWith(
  email: string,
  password: string,
  redirectTo: string,
): Promise<AuthFormState> {
  try {
    await signIn("credentials", { email, password, redirectTo });
    return {};
  } catch (error) {
    // signIn redirects on success by throwing; only Auth.js errors are handled here.
    if (!(error instanceof AuthError)) throw error;
    if (error.type !== "CredentialsSignin") {
      // Not a wrong password: e.g. the database is unreachable. Logged by Auth.js.
      return {
        values: { email },
        error: "Sign-in is unavailable right now. Try again in a moment.",
      };
    }
    const limited = "code" in error && error.code === "rate_limited";
    return {
      values: { email },
      error: limited
        ? "Too many attempts. Wait a few minutes and try again."
        : "Incorrect email or password.",
    };
  }
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email || !password)
    return { values: { email }, error: "Enter your email and password." };
  return signInWith(email, password, safeRedirect(formData.get("callbackUrl")));
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const values = { name, email };

  const fieldErrors: AuthFormState["fieldErrors"] = {};
  if (name.length < 2 || name.length > 100)
    fieldErrors.name = "Enter your full name (2–100 characters).";
  if (!isValidEmail(email)) fieldErrors.email = "Enter a valid email address.";
  else if (!isAllowedSignupEmail(email))
    fieldErrors.email = `Use your ${allowedSignupDomains()
      .map((d) => `@${d}`)
      .join(" or ")} address.`;
  const problem = passwordProblem(password);
  if (problem) fieldErrors.password = problem;
  else if (password !== confirmPassword)
    fieldErrors.confirmPassword = "Passwords do not match.";
  if (Object.keys(fieldErrors).length > 0) return { values, fieldErrors };

  if (
    !takeAttempt(`signup:ip:${clientIp(await headers())}`, 5, 60 * 60 * 1000)
  ) {
    return {
      values,
      error: "Too many sign-up attempts from this network. Try again later.",
    };
  }

  const db = await getDb();
  // The role is fixed here: self-service accounts are always read-only professors.
  const created = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash: await hashPassword(password),
      role: "PROFESSOR",
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });

  if (created.length === 0) {
    return {
      values,
      fieldErrors: {
        email: "An account with this email already exists. Sign in instead.",
      },
    };
  }

  return signInWith(email, password, safeRedirect(formData.get("callbackUrl")));
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
