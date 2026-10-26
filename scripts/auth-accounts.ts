/** Trusted operator command; never pass passwords as arguments or environment variables. */
import "dotenv/config";

import { emitKeypressEvents } from "node:readline";
import { eq } from "drizzle-orm";
import { db, postgresClient } from "../db";
import { departments, users } from "../db/schema";
import { hashPassword } from "../lib/auth/password-core";
import { isValidEmail, normalizeEmail, passwordProblem } from "../lib/auth/validation";

type Role = "SUPERADMIN" | "ADMIN" | "PROFESSOR";
function usage(): never {
  throw new Error("Usage: npm run auth:account -- create --email ADDRESS --role SUPERADMIN|ADMIN|PROFESSOR [--department CODE] [--name NAME]\n   or: npm run auth:account -- reset-password --email ADDRESS");
}

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  if (command !== "create" && command !== "reset-password") usage();
  const values = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const value = rest[i + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--") || values.has(key) || !["--email", "--role", "--department", "--name"].includes(key)) usage();
    values.set(key, value);
  }
  const email = normalizeEmail(values.get("--email"));
  if (!isValidEmail(email)) throw new Error("Provide a valid full email address.");
  if (command === "reset-password") {
    if (values.size !== 1) usage();
    return { command, email } as const;
  }
  const role = values.get("--role");
  if (role !== "SUPERADMIN" && role !== "ADMIN" && role !== "PROFESSOR") usage();
  const department = values.get("--department")?.trim().toLowerCase();
  if ((role === "SUPERADMIN" && department) || (role !== "SUPERADMIN" && !department)) {
    throw new Error("SUPERADMIN must have no department; ADMIN and PROFESSOR require --department CODE.");
  }
  const name = values.get("--name")?.trim().replace(/\s+/g, " ") || null;
  if (name && name.length > 100) throw new Error("Name must be at most 100 characters.");
  return { command, email, role: role as Role, department, name } as const;
}

/** Raw terminal input avoids echoing passwords, including on Windows consoles. */
function secret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error("An interactive terminal is required to enter a password privately.");
  process.stderr.write(prompt);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stderr.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onKey = (character: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") return finish(new Error("Cancelled."));
      if (key.name === "return" || key.name === "enter") return finish();
      if (key.name === "backspace") { value = value.slice(0, -1); return; }
      if (character && !key.ctrl && character >= " ") value += character;
    };
    process.stdin.on("keypress", onKey);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, args.email)).limit(1);
  if (args.command === "create" && existing) throw new Error("That account already exists; no changes were made.");
  if (args.command === "reset-password" && !existing) throw new Error("Account not found; no changes were made.");

  let departmentId: string | null = null;
  if (args.command === "create" && args.department) {
    const [department] = await db.select({ departmentId: departments.departmentId }).from(departments).where(eq(departments.code, args.department)).limit(1);
    if (!department) throw new Error(`Unknown department code: ${args.department}`);
    departmentId = department.departmentId;
  }

  const password = await secret("Password: ");
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  if (password !== await secret("Confirm password: ")) throw new Error("Passwords do not match; no changes were made.");
  const passwordHash = await hashPassword(password);

  if (args.command === "create") {
    const created = await db.insert(users).values({ email: args.email, name: args.name, role: args.role, departmentId, passwordHash })
      .onConflictDoNothing({ target: users.email }).returning({ id: users.id });
    if (!created.length) throw new Error("That account already exists; no changes were made.");
    process.stdout.write(`Created ${args.role} account ${args.email}.\n`);
  } else {
    const updated = await db.update(users).set({ passwordHash }).where(eq(users.email, args.email)).returning({ id: users.id });
    if (!updated.length) throw new Error("Account not found; no changes were made.");
    process.stdout.write(`Reset password for ${args.email}.\n`);
  }
}

main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "Account command failed."}\n`); process.exitCode = 1; })
  .finally(() => postgresClient.end());
