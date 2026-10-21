/**
 * Auth.js (NextAuth v5): email + password sign-in against the users table.
 * Sessions are encrypted JWT cookies (Credentials sign-in requires the JWT strategy).
 */
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { burnPasswordCheck, verifyPassword } from "@/lib/auth/password";
import { clientIp, resetAttempts, takeAttempt } from "@/lib/auth/rate-limit";
import {
  isValidEmail,
  loginEmail,
  PASSWORD_MAX,
} from "@/lib/auth/validation";
import { authConfig } from "./auth.config";

/** Shown when an address or account has had too many failed attempts. */
export class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      // Runs for every credentials sign-in, including direct POSTs to /api/auth/callback/credentials.
      async authorize(credentials, request) {
        const email = loginEmail(credentials?.email);
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!isValidEmail(email) || !password || password.length > PASSWORD_MAX)
          return null;

        const ip = clientIp(request.headers);
        const accountKey = `signin:account:${email}`;
        const ipKey = `signin:ip:${ip}`;
        if (
          !takeAttempt(accountKey, 5, FIFTEEN_MINUTES) ||
          !takeAttempt(ipKey, 30, FIFTEEN_MINUTES)
        ) {
          throw new TooManyAttempts();
        }

        const db = await getDb();
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (!user?.passwordHash) {
          await burnPasswordCheck(password);
          return null;
        }
        if (!(await verifyPassword(password, user.passwordHash))) return null;

        resetAttempts(accountKey);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
