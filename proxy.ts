/**
 * Runs before every page request: visitors without a valid session cookie are sent to
 * /login, and signed-in users are sent from /login to the dashboard (see auth.config.ts).
 * This is a first filter only; lib/auth/dal.ts re-verifies the user where data is read
 * or changed.
 */
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  // Keep the dashboard alias redirect out of the Server Component render. A
  // redirect() from that page aborts RSC prerender timing in Next dev/Turbopack
  // and can trigger a negative Performance.measure timestamp in the dev client.
  if (request.nextUrl.pathname === "/dashboard") {
    return NextResponse.redirect(new URL("/dashboard/ug", request.url));
  }
});

export const config = {
  // Everything except Auth.js endpoints, Next.js internals and public files.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|gif|ico|otf|woff2?|txt)$).*)",
  ],
};
