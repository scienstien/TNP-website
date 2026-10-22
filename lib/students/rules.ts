/**
 * Pure participation rules for student writes. No database access, so they are unit-tested
 * directly; lib/students/store.ts applies them to rows it has locked inside its transaction.
 */
import type { RegistrationStatusValue } from "@/lib/placements/types";

export type RegistrationStatus = RegistrationStatusValue;

export interface Participation {
  cycleId: string;
  registrationStatus: RegistrationStatus;
}

export type OfferTarget = { cycleId: string; problem?: undefined } | { cycleId?: undefined; problem: string };

/**
 * The student-cycle an offer write belongs to. An existing offer keeps its own cycle. Otherwise the
 * caller names the cycle, or the enrollment has exactly one participation; anything else is
 * ambiguous and is rejected rather than guessed. The target participation must be REGISTERED:
 * an UNREGISTERED candidate cannot have an offer (TASKS.md MIG-001 decision).
 */
export function offerTarget(
  participations: readonly Participation[],
  offerCycleId: string | null,
  requestedCycleId?: string,
): OfferTarget {
  let cycleId: string;
  if (offerCycleId) {
    if (requestedCycleId && requestedCycleId !== offerCycleId) {
      return { problem: "This offer belongs to another placement cycle. Moving an offer between cycles is not supported." };
    }
    cycleId = offerCycleId;
  } else if (requestedCycleId) {
    cycleId = requestedCycleId;
  } else if (participations.length === 1) {
    cycleId = participations[0].cycleId;
  } else {
    return {
      problem: participations.length
        ? "Choose the placement cycle this offer belongs to."
        : "Register the student for a placement cycle before recording an offer.",
    };
  }
  const participation = participations.find((row) => row.cycleId === cycleId);
  if (!participation) return { problem: "The student has no participation in that placement cycle." };
  if (participation.registrationStatus !== "REGISTERED") {
    return { problem: "An UNREGISTERED student cannot have an offer in that placement cycle." };
  }
  return { cycleId };
}

/**
 * Registration changes never remove an offer to make themselves succeed: a participation holding
 * the enrollment's offer cannot become UNREGISTERED (TASKS.md MIG-001 decision).
 */
export function registrationChangeProblem(
  offerCycleId: string | null,
  cycleId: string,
  registrationStatus: RegistrationStatus,
): string | null {
  return registrationStatus === "UNREGISTERED" && offerCycleId === cycleId
    ? "This placement cycle holds the student's offer. Remove the offer before marking the student UNREGISTERED."
    : null;
}

/** A participation holding the enrollment's offer cannot be removed (the offer depends on it). */
export function participationRemovalProblem(offerCycleId: string | null, cycleId: string): string | null {
  return offerCycleId === cycleId
    ? "This placement cycle holds the student's offer. Remove the offer before removing the registration."
    : null;
}

/**
 * A student (person) can hold enrollments in several departments. A department's administrator
 * may change the shared person only when every other enrollment is in the same department;
 * cross-department ownership needs an explicit policy first (TASKS.md MIG-001).
 */
export function sharedPersonProblem(departmentId: string, otherEnrollmentDepartmentIds: readonly string[]): string | null {
  return otherEnrollmentDepartmentIds.some((id) => id !== departmentId)
    ? "This person also has an enrollment in another department, so the shared name cannot be changed here."
    : null;
}
