/**
 * Auth.js settings that need no database, shared by the proxy and the full config in auth.ts.
 * The proxy only checks that a valid session cookie exists (an optimistic check); pages,
 * Server Actions and route handlers re-check the user against the database through
 * lib/auth/dal.ts.
 */
import type { NextAuthConfig } from "next-auth";

/** Pages reachable without signing in. Everything else requires a session. */
const PUBLIC_PATHS = ["/login", "/logo-preview"];

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60, updateAge: 60 * 60 },
  providers: [], // added in auth.ts (needs the database)
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const signedIn = Boolean(auth?.user?.id);
      const isPublic = PUBLIC_PATHS.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
      );

      if (pathname === "/login" && signedIn)
        return Response.redirect(new URL("/", request.nextUrl));
      if (isPublic) return true;
      return signedIn; // false sends the visitor to /login?callbackUrl=...
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.role) session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
