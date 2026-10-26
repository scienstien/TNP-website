"use server";

import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { DEPARTMENT_COOKIE } from "./dal";

export interface AuthFormState {
  error?: string;
  values?: { email?: string };
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
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password)
    return { values: { email }, error: "Enter your email and password." };
  // A prior user or local bypass may have left a department preference in this browser.
  (await cookies()).delete(DEPARTMENT_COOKIE);
  return signInWith(email, password, safeRedirect(formData.get("callbackUrl")));
}

export async function signOutAction() {
  (await cookies()).delete(DEPARTMENT_COOKIE);
  await signOut({ redirectTo: "/login" });
}
