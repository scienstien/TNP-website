import { Suspense } from "react";
import { notFound } from "next/navigation";
import ChooseDepartment from "@/components/portal/ChooseDepartment";
import StudentRecords from "@/components/students/StudentRecords";
import { getStudentData } from "@/lib/students/queries";
import type { StudentDegreeLevel } from "@/lib/students/types";
import { parseStudentDegreeLevel } from "@/lib/students/validation";

export default async function StudentsByLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level: segment } = await params;
  const level = parseStudentDegreeLevel(segment);
  if (!level) notFound();
  return (
    <Suspense fallback={<section className="panel" role="status" aria-busy="true"><p>Loading student records…</p></section>}>
      <StudentData level={level} />
    </Suspense>
  );
}

/** Authorization, department resolution and data loading remain per-request and uncached. */
async function StudentData({ level }: { level: StudentDegreeLevel }) {
  const studentData = await getStudentData(level);
  return studentData ? <StudentRecords data={studentData} /> : <ChooseDepartment />;
}
