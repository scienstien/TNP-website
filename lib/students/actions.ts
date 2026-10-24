"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, isAdminRole, resolveDepartment } from "@/lib/auth/dal";
import { mutateStudent, type Operation } from "./store";
import type { CompanyResult, StudentResult } from "./types";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { validateCompany } from "./company-validation";
import { parseStudentDegreeLevel } from "./validation";

/** The admin's department (or the super admin's chosen one), or the error to show instead. */
async function adminDepartment(action: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  if (!isAdminRole(user.role)) return { error: `Only administrators can ${action}.` };
  const department = await resolveDepartment(user);
  if (!department) return { error: "Choose a department first." };
  return { department };
}

async function run(levelInput: unknown, operation: Operation, input: unknown, roll?: unknown, expected?: unknown): Promise<StudentResult> {
  const level = parseStudentDegreeLevel(levelInput);
  if (!level) return { error: "Choose the UG or PG student-records view." };
  const scope = await adminDepartment("manage student records");
  if ("error" in scope) return { error: scope.error };
  const result = await mutateStudent(scope.department.departmentId, level, operation, input, roll, expected);
  if (result.ok) {
    revalidatePath("/");
    revalidatePath(`/students/${level.toLowerCase()}`);
  }
  return result;
}
export async function createStudent(level: unknown, input: unknown) { return run(level, "create", input); }
export async function patchStudent(level: unknown, roll: unknown, changes: unknown, expected: unknown) { return run(level, "patch", changes, roll, expected); }
export async function removeStudentOffer(level: unknown, roll: unknown, expected: unknown) { return run(level, "removeOffer", null, roll, expected); }
export async function deleteStudent(level: unknown, roll: unknown, expected: unknown) { return run(level, "removeStudent", null, roll, expected); }
/** Registers the student for an explicit cycle, or changes that registration's status. */
export async function setStudentParticipation(level: unknown, roll: unknown, participation: unknown, expected: unknown) {
  return run(level, "setParticipation", participation, roll, expected);
}
/** Removes one registration; refused while that cycle holds the student's offer. */
export async function removeStudentParticipation(level: unknown, roll: unknown, cycleId: unknown, expected: unknown) {
  return run(level, "removeParticipation", { cycleId }, roll, expected);
}

/** Explicit creation only: never overwrite a company's existing profile or contacts. */
export async function createStudentCompany(input: unknown): Promise<CompanyResult> {
  const scope = await adminDepartment("create companies");
  if ("error" in scope) return { error: scope.error };
  const { data, fieldErrors } = validateCompany(input);
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  try {
    const [company] = await db.insert(companies)
      .values({ name: data.name, domain: data.domain })
      .onConflictDoNothing({ target: companies.name })
      .returning({ companyId: companies.companyId, name: companies.name, domain: companies.domain });
    if (!company) return { fieldErrors: { name: "This company already exists. Select it from the list." } };
    revalidatePath("/");
    return { ok: true, company };
  } catch {
    return { error: "Unable to create the company. Your student draft has not been changed." };
  }
}
