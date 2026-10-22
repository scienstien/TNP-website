import { and, eq, type SQL } from "drizzle-orm";
import {
  degrees,
  departments,
  placementOffers,
  studentCycles,
} from "@/db/schema";

/** Keep placement analytics on UG records and, when selected, one authorized department. */
export function placementRecordsScope(departmentId: string | null): SQL {
  return departmentId
    ? and(
        eq(degrees.level, "UG"),
        eq(departments.departmentId, departmentId),
      )!
    : eq(degrees.level, "UG");
}

/** An offer belongs to a participation only when both enrollment and cycle agree. */
export function offerForParticipation(): SQL {
  return and(
    eq(placementOffers.enrollmentId, studentCycles.enrollmentId),
    eq(placementOffers.cycleId, studentCycles.cycleId),
  )!;
}
