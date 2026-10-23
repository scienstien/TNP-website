import { Suspense } from "react";
import ChooseDepartment from "@/components/portal/ChooseDepartment";
import StudentRecords from "@/components/students/StudentRecords";
import { getStudentData } from "@/lib/students/queries";

export default function StudentsPage() {
  return (
    <Suspense fallback={<section className="panel" role="status" aria-busy="true"><p>Loading student records…</p></section>}>
      <StudentData />
    </Suspense>
  );
}

/**
 * Per-request and uncached: getStudentData() runs the ADMIN check before it reads the department
 * cookie or the database, so authorization still happens on every request.
 */
async function StudentData() {
  const studentData = await getStudentData();
  return studentData ? <StudentRecords data={studentData} /> : <ChooseDepartment />;
}
