"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { mutateStudent, type Operation } from "./store";
import type { CompanyResult, StudentResult } from "./types";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { validateCompany } from "./company-validation";

async function run(operation: Operation, input: unknown, roll?: unknown, expected?: unknown): Promise<StudentResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  if (user.role !== "ADMIN") return { error: "Only administrators can manage student records." };
  const result = await mutateStudent(operation, input, roll, expected);
  if (result.ok) revalidatePath("/");
  return result;
}
export async function createStudent(input: unknown) { return run("create", input); }
export async function patchStudent(roll: unknown, changes: unknown, expected: unknown) { return run("patch", changes, roll, expected); }
export async function removeStudentOffer(roll: unknown, expected: unknown) { return run("removeOffer", null, roll, expected); }
export async function deleteStudent(roll: unknown, expected: unknown) { return run("removeStudent", null, roll, expected); }

/** Explicit creation only: never overwrite a company's existing profile or contacts. */
export async function createStudentCompany(input: unknown): Promise<CompanyResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  if (user.role !== "ADMIN") return { error: "Only administrators can create companies." };
  const { data, fieldErrors } = validateCompany(input);
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  try {
    const [company] = await db.insert(companies).values(data)
      .onConflictDoNothing({ target: companies.name })
      .returning({ name: companies.name, domain: companies.domain });
    if (!company) return { fieldErrors: { name: "This company already exists. Select it from the list." } };
    revalidatePath("/");
    return { ok: true, company };
  } catch {
    return { error: "Unable to create the company. Your student draft has not been changed." };
  }
}
