import { Suspense } from "react";
import StudentRecords from "@/components/students/StudentRecords";
import { parseStudentListParams } from "@/lib/students/list-params";
import { getStudentData } from "@/lib/students/queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<section className="panel" role="status" aria-busy="true"><p>Loading student records…</p></section>}>
      <StudentData searchParams={searchParams} />
    </Suspense>
  );
}

/**
 * Per-request and uncached: getStudentData() runs the ADMIN check before it reads the department
 * cookie or the database, so authorization still happens on every request.
 */
async function StudentData({ searchParams }: { searchParams: SearchParams }) {
  const data = await getStudentData(parseStudentListParams(await searchParams));
  return <StudentRecords data={data} />;
}
