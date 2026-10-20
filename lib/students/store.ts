import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, placementOffers, students } from "@/db/schema";
import type { StudentRecord, StudentResult } from "./types";
import { rollProblem, validateStudent } from "./validation";

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function readStudent(connection: Database | Transaction, roll: number): Promise<StudentRecord | null> {
  const [student] = await connection.select().from(students).where(eq(students.rollNumber, roll));
  if (!student) return null;
  const [offer] = await connection.select().from(placementOffers).where(eq(placementOffers.studentRollNumber, roll));
  return { ...student, offer: offer ? {
    companyName: offer.companyName, jobRole: offer.jobRole, packageLpa: offer.packageLpa,
    offerType: offer.offerType, offerDate: offer.offerDate,
  } : null };
}

export type Operation = "create" | "patch" | "removeOffer" | "removeStudent";

/** Internal persistence only. All public entrypoints must authorize before calling. */
export async function mutateStudent(
  operation: Operation, input: unknown, roll?: unknown, expected?: unknown,
): Promise<StudentResult> {
  if (operation !== "create" && rollProblem(roll)) {
    return { fieldErrors: { rollNumber: rollProblem(roll)! } };
  }
  const parsed = operation === "create" || operation === "patch"
    ? validateStudent(input, operation === "create") : { data: {}, fieldErrors: {} };
  if (Object.keys(parsed.fieldErrors).length) return { fieldErrors: parsed.fieldErrors };
  if (operation !== "create" && typeof expected !== "string") return { error: "Reload this record before saving." };
  try {
    return await db.transaction(async tx => {
      const { data } = parsed;
      const id = operation === "create" ? data.rollNumber! : Number(roll);
      if (operation === "create") {
        await tx.insert(students).values({ rollNumber: id, name: data.name!, batchYear: data.batchYear! });
      } else {
        // Serialize writes for the student and detect edits based on stale server data.
        await tx.select({ roll: students.rollNumber }).from(students)
          .where(eq(students.rollNumber, id)).for("update");
        const current = await readStudent(tx, id);
        if (!current) return { error: "This student no longer exists. Refresh the records." };
        if (JSON.stringify(current) !== expected) return { error: "This record changed. Cancel and reopen it to load the latest values." };
        if (operation === "removeOffer") {
          if (!current.offer) return { error: "This student no longer has an offer." };
          await tx.delete(placementOffers).where(eq(placementOffers.studentRollNumber, id));
          return { ok: true };
        }
        if (operation === "removeStudent") {
          if (current.offer) return { error: "Remove the student's offer before deleting the student." };
          await tx.delete(students).where(eq(students.rollNumber, id));
          return { ok: true };
        }
        const changes: { name?: string; batchYear?: number } = {};
        if (data.name !== undefined) changes.name = data.name;
        if (data.batchYear !== undefined) changes.batchYear = data.batchYear;
        if (Object.keys(changes).length) await tx.update(students).set(changes).where(eq(students.rollNumber, id));
      }
      if (data.offer && Object.keys(data.offer).length) {
        if (data.offer.companyName !== undefined) {
          const [company] = await tx.select({ name: companies.name }).from(companies)
            .where(eq(companies.name, data.offer.companyName));
          if (!company) throw new StudentError("Select an existing company.", "companyName");
        }
        const [existing] = await tx.select().from(placementOffers).where(eq(placementOffers.studentRollNumber, id));
        if (existing) {
          await tx.update(placementOffers).set(data.offer).where(eq(placementOffers.studentRollNumber, id));
        } else {
          if (!data.offer.companyName) throw new StudentError("Select an existing company.", "companyName");
          await tx.insert(placementOffers).values({
            studentRollNumber: id, ...data.offer, companyName: data.offer.companyName,
          });
        }
      }
      return { ok: true };
    });
  } catch (error) {
    if (error instanceof StudentError) return { fieldErrors: { [error.field]: error.message } };
    const cause = error instanceof Error && error.cause ? error.cause : error;
    const code = (cause as { code?: string })?.code;
    if (code === "23505") return { fieldErrors: { rollNumber: "This roll number already exists. No existing record was changed." } };
    if (code === "23503") return { error: "A referenced record changed or still has an offer. Refresh and try again." };
    if (code === "23514" || code === "23502" || code === "22003") return { error: "The values do not meet database constraints." };
    return { error: "Unable to save changes. Please retry." };
  }
}
class StudentError extends Error {
  constructor(message: string, readonly field: string) { super(message); }
}
