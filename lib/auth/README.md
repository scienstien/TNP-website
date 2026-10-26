# Authentication and access

Auth.js Credentials sign-in uses `users` in PostgreSQL and encrypted JWT session cookies. Public sign-up is closed. The login form accepts a full email or a bare username under the first `ALLOWED_SIGNUP_DOMAINS` domain (default `nitt.edu`). Sessions last eight hours and refresh hourly.

| Role | Reads | Writes |
| --- | --- | --- |
| PROFESSOR | Assigned department's dashboard, calendar and outreach views | None |
| ADMIN | All-department summaries or any selected department | Selected department only |
| SUPERADMIN | All-department summaries or any selected department | Selected department only |

The company directory and drive stages are institute-wide records. Department selection scopes offer aggregates and department-owned records. Student Records requires one selected department even for reading. “All departments” is read-only for actions that require a department. ADMIN's assigned `users.department_id` remains recorded but does not limit its temporary cross-department access. A missing assigned department makes an ADMIN or PROFESSOR account invalid; it must never become an all-department read. The selected department cookie is validated against the database on every request and cleared at sign-out.

`proxy.ts` checks for a signed cookie. Every protected page, Server Action and route handler must independently use `requireUser()`, `requireRole()`, or `getCurrentUser()` in `lib/auth/dal.ts`; role and department must come from the database, never the client. Import preview tokens bind the user and selected department. A changed role or deleted user takes effect on the next request; stale sessions are cleared through `/auth/session-expired`.

The proxy returns HTTP 404 for `/students` requests whose session role is PROFESSOR, before rendering the page. The Student Records query still checks the current database role with `requireRole("ADMIN")` before reading data, so a stale session role never grants access.

## Local development

Set `DATABASE_URL` and a unique `AUTH_SECRET` in untracked `.env`, run migrations, then start the app. Development automatically creates `superadmin / test123` and `admin123<department code> / test1234` accounts if absent. This never happens in production. Do not point a development server at a production or shared database. `AUTH_BYPASS` and production trial-account creation are removed.

## First deployment and operator accounts

Apply migrations and configure `DATABASE_URL` and a strong `AUTH_SECRET` before starting the production app. Create the first real SUPERADMIN using an interactive terminal:

```sh
npm run auth:account -- create --email admin@nitt.edu --role SUPERADMIN --name "TNP Administrator"
```

Create department accounts with `--role ADMIN` or `--role PROFESSOR` and `--department <code>`. The department must exist. Passwords are prompted twice without terminal echo, checked against the app's 8–128 character rule, and stored only as scrypt hashes. Existing emails are refused. To replace a forgotten password:

```sh
npm run auth:account -- reset-password --email admin@nitt.edu
```

Password reset does not revoke already-issued JWT sessions; deleting the user or changing its role takes effect on the next request. Operate the command only from a trusted terminal with access to the intended database. Do not place passwords in command arguments, scripts, logs or environment files.

## Safety checks

- Unknown email and wrong password share a generic sign-in message; sign-in attempts are limited per account and IP per server process.
- The proxy is an optimistic filter. Server data access always re-reads the account, role and department assignment.
- The selected department is server-validated. ADMIN and SUPERADMIN actions requiring one department reject “All departments.” PROFESSOR actions reject writes even if invoked directly.
- Use fictional accounts and an isolated database for browser and import tests.
