import "dotenv/config";

import { db, postgresClient } from "./index";
import { companies, placementOffers, students } from "./schema";

const demoCompanies: (typeof companies.$inferInsert)[] = [
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
  { rollNumber: "DEMO-2026-001", name: "Asha Example", batchYear: 2026 },
  { rollNumber: "DEMO-2026-002", name: "Bala Example", batchYear: 2026 },
  { rollNumber: "DEMO-2026-003", name: "Charu Example", batchYear: 2026 },
];

const demoOffers: (typeof placementOffers.$inferInsert)[] = [
  {
    companyName: "DEMO Metals Ltd",
    studentRollNumber: "DEMO-2026-001",
    jobRole: "Graduate Engineer",
    packageLpa: "12.50",
    offerType: "FTE",
    offerDate: "2025-09-15",
  },
  {
    companyName: "DEMO Materials Labs",
    studentRollNumber: "DEMO-2026-002",
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
