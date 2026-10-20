"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { mutateStudent, type Operation } from "./store";
import type { StudentResult } from "./types";

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
