import ChooseDepartment from "@/components/portal/ChooseDepartment";
import StudentRecords from "@/components/students/StudentRecords";
import { requireRole } from "@/lib/auth/dal";
import { getStudentData } from "@/lib/students/queries";

export default async function StudentsPage() {
  await requireRole("ADMIN");
  const studentData = await getStudentData();

  return studentData ? <StudentRecords data={studentData} /> : <ChooseDepartment />;
}
