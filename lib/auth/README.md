# Authentication

Email + password sign-in and professor sign-up with Auth.js (NextAuth v5), backed by the `users` table in `db/schema.ts`.

## Who can do what

| | Signed out | PROFESSOR | ADMIN | SUPERADMIN |
| --- | --- | --- | --- | --- |
| `/login` (sign in / sign up) | yes | redirected to `/` | redirected to `/` | redirected to `/` |
| Dashboard (`/`): home, overview, drive calendar | redirected to `/login` | own department, read-only | own department | any department, or all (read-only) |
| Student records editing, companies, outreach | — | — | own department | the department chosen in the department navbar |
| Create an account | professor accounts only (`@nitt.edu`), with a department | — | — | — |

Admin and super admin accounts cannot be created through the UI. The role and department always come from the database: the sign-up form ignores any `role` field, and the dashboard receives both from the server. Everyone except a SUPERADMIN is pinned to their own department by `resolveDepartment()` in `lib/auth/dal.ts`; a SUPERADMIN's department choice is a cookie that is re-checked against the database on every request.

## Files

- `auth.config.ts`: settings that need no database (pages, session, callbacks). Shared with the proxy.
- `auth.ts`: the Credentials provider. It validates input, rate-limits, looks the user up, and verifies the scrypt hash.
- `proxy.ts`: sends visitors without a session to `/login`, and signed-in users from `/login` to `/`.
- `lib/auth/dal.ts`: **use this for every protected read or write.**
  - `getCurrentUser()` returns the signed-in user, re-read from the database.
  - `requireUser()` redirects to `/login` when no one is signed in.
  - `requireRole('ADMIN')` returns a 404 for non-admins (a SUPERADMIN passes too).
  - `resolveDepartment(user)` is the department a request acts on; use it for every department-scoped read or write.
- `lib/auth/actions.ts`: the `signInAction`, `signUpAction` and `signOutAction` Server Actions.
- `lib/auth/password.ts`: scrypt hashing and verification, with a constant-time check for unknown emails.
- `lib/auth/rate-limit.ts`: in-memory attempt limits.
- `lib/auth/validation.ts`: email, password and sign-up domain rules.
- `lib/auth/dev-accounts.ts`: the development super admin and department admins.
- `lib/auth/department-actions.ts`: the super admin's department switcher.
- `app/login/AuthForms.tsx`: the Sign in / Sign up tabs.

## Protecting new code

```ts
// Admin-only Server Action
'use server';
import { requireRole } from '@/lib/auth/dal';

export async function updatePlacement(formData: FormData) {
  await requireRole('ADMIN'); // throws before anything changes
  // ...
}
```

In a route handler, call `getCurrentUser()` and return `401` or `403` yourself.

## Safety measures

- **Passwords:** scrypt with N=2¹⁵, r=8, p=1, a 16-byte salt and a 64-byte key. Passwords must be 8–128 characters with letters and digits. The upper limit caps the hashing cost per request.
- **Sessions:** encrypted (JWE) cookies, httpOnly and SameSite=Lax, Secure over HTTPS. They last 8 hours and refresh hourly.
- **Account enumeration:** a wrong password and an unknown email give the same message and take the same time. Sign-up does say when an email is already registered; that is a deliberate usability trade-off.
- **Brute force:**
  - Sign-in: 5 failed attempts per account and 30 per IP address, per 15 minutes.
  - Sign-up: 5 per IP address per hour.

  The limits are per server process. With several instances, move them to a shared store.
- **Open redirect:** `callbackUrl` is restricted to same-site paths.
- **CSRF:** Server Actions are protected by Next.js origin checks, and the Auth.js endpoints by their CSRF token.
- **Role changes:** a deleted user or a changed role takes effect on the next request, because the role is read from the database rather than trusted from the cookie.

## Configuration

See `.env.example`. Auth needs `AUTH_SECRET` (generate it with `npx auth secret`) and the same `DATABASE_URL` the rest of the app uses. `ALLOWED_SIGNUP_DOMAINS` defaults to `nitt.edu`.

**Local development:**
1. Copy `.env.example` to `.env` and fill in `AUTH_SECRET`.
2. Start PostgreSQL and apply the migrations, as described in `db/README.md`:
   ```sh
   npm run db:up
   npm run db:migrate
   ```
3. Run `npm run dev`.

The first sign-in request creates the trial admin if it doesn't exist yet.

Development logins (created by `lib/auth/dev-accounts.ts`, for departments in the database; the usernames need no domain):

| Login | Password | Role |
| --- | --- | --- |
| `superadmin` | `test123` | SUPERADMIN, all departments |
| `admin123civil`, `admin123cse`, `admin123ece`, `admin123mech` (or the full `@nitt.edu` address) | `test1234` | ADMIN of that department |

They are created only in development, or in production only if `SEED_TRIAL_ADMIN=true`. Change or remove them before any real deployment. Load the demo departments first with `npm run db:seed:departments`.
