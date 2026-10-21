import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";

const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/;

/**
 * Clears a session cookie whose account no longer exists, then shows the login page.
 * A valid session is left untouched (so a link to this route cannot sign anyone out).
 */
export async function GET(request: NextRequest) {
  if (await getCurrentUser()) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  for (const { name } of request.cookies.getAll()) {
    if (!SESSION_COOKIE.test(name)) continue;
    response.cookies.set(name, "", {
      maxAge: 0,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: name.startsWith("__Secure-"),
    });
  }
  return response;
}
