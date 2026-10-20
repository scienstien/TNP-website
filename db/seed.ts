import "dotenv/config";

import { db, postgresClient } from "./index";
import { companies, placementOffers, students } from "./schema";

const demoCompanies: (typeof companies.$inferInsert)[] = [
  {
    name: "DEMO Precision Alloys",
    domain: "Alloy manufacturing",
    hrName: "Demo Alloy Recruiter",
    email: "alloys@example.com",
    phoneNumber: null,
    pvrStatus: null,
  },
  {
    name: "DEMO Ceramic Technologies",
    domain: "Advanced ceramics",
    hrName: "Demo Ceramic Recruiter",
    email: "ceramics@example.com",
    phoneNumber: null,
    pvrStatus: null,
  },
  {
    name: "DEMO Sustainable Materials",
    domain: "Materials recycling",
    hrName: null,
    email: "materials@example.com",
    phoneNumber: null,
    pvrStatus: null,
  },
  {
    name: "DEMO Metals Ltd",
    domain: "Metals manufacturing",
    hrName: "Demo Recruiter",
    email: "recruiter@example.com",
    phoneNumber: null,
    pvrStatus: true,
  },
  {
    name: "DEMO Materials Labs",
    domain: "Materials research",
    hrName: null,
    email: null,
    phoneNumber: null,
    pvrStatus: null,
  },
];

const demoStudents: (typeof students.$inferInsert)[] = [
  { rollNumber: 926000001, name: "Asha Example", batchYear: 2026 },
  { rollNumber: 926000002, name: "Bala Example", batchYear: 2026 },
  { rollNumber: 926000003, name: "Charu Example", batchYear: 2026 },
  { rollNumber: 926000004, name: "Dev Example", batchYear: 2026 },
  { rollNumber: 926000005, name: "Esha Example", batchYear: 2026 },
  { rollNumber: 926000006, name: "Farid Example", batchYear: 2026 },
  { rollNumber: 926000007, name: "Gita Example", batchYear: 2026 },
  { rollNumber: 926000008, name: "Hari Example", batchYear: 2026 },
  { rollNumber: 926000009, name: "Indu Example", batchYear: 2026 },
  { rollNumber: 926000010, name: "Jai Example", batchYear: 2026 },
  { rollNumber: 926000011, name: "Kavya Example", batchYear: 2026 },
];

const demoOffers: (typeof placementOffers.$inferInsert)[] = [
  {
    companyName: "DEMO Precision Alloys",
    studentRollNumber: 926000004,
    jobRole: "Process Engineer",
    packageLpa: "10.50",
    offerType: "FTE",
    offerDate: "2025-10-20",
  },
  {
    companyName: "DEMO Ceramic Technologies",
    studentRollNumber: 926000005,
    jobRole: "Materials Engineer",
    packageLpa: "9.00",
    offerType: "FTE+6month",
    offerDate: "2025-11-12",
  },
  {
    companyName: "DEMO Sustainable Materials",
    studentRollNumber: 926000006,
    jobRole: "Recycling Process Engineer",
    packageLpa: "8.50",
    offerType: "PPO",
    offerDate: "2025-08-25",
  },
  {
    companyName: "DEMO Precision Alloys",
    studentRollNumber: 926000007,
    jobRole: "Quality Engineer",
    packageLpa: "11.00",
    offerType: "FTE",
    offerDate: "2026-01-14",
  },
  {
    companyName: "DEMO Metals Ltd",
    studentRollNumber: 926000008,
    jobRole: "Graduate Engineer",
    packageLpa: "12.00",
    offerType: "FTE",
    offerDate: "2026-02-10",
  },
  {
    companyName: "DEMO Metals Ltd",
    studentRollNumber: 926000001,
    jobRole: "Graduate Engineer",
    packageLpa: "12.50",
    offerType: "FTE",
    offerDate: "2025-09-15",
  },
  {
    companyName: "DEMO Materials Labs",
    studentRollNumber: 926000002,
    jobRole: "Research Associate",
    packageLpa: null,
    offerType: "PPO",
    offerDate: null,
  },
];

async function seed() {
  await db.transaction(async (transaction) => {
    for (const company of demoCompanies) {
      await transaction
        .insert(companies)
        .values(company)
        .onConflictDoUpdate({
          target: companies.name,
          set: {
            domain: company.domain,
            hrName: company.hrName,
            email: company.email,
            phoneNumber: company.phoneNumber,
            pvrStatus: company.pvrStatus,
          },
        });
    }

    for (const student of demoStudents) {
      await transaction
        .insert(students)
        .values(student)
        .onConflictDoUpdate({
          target: students.rollNumber,
          set: {
            name: student.name,
            batchYear: student.batchYear,
          },
        });
    }

    for (const offer of demoOffers) {
      await transaction
        .insert(placementOffers)
        .values(offer)
        .onConflictDoUpdate({
          target: placementOffers.studentRollNumber,
          set: {
            companyName: offer.companyName,
            jobRole: offer.jobRole,
            packageLpa: offer.packageLpa,
            offerType: offer.offerType,
            offerDate: offer.offerDate,
          },
        });
    }
  });

  console.log(
    `Seeded ${demoCompanies.length} companies, ${demoStudents.length} students, and ${demoOffers.length} offers.`,
  );
}

async function main() {
  try {
    await seed();
  } catch (error) {
    console.error("Failed to seed the database.", error);
    process.exitCode = 1;
  } finally {
    await postgresClient.end();
  }
}

void main();
