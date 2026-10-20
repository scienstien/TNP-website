/**
 * FICTIONAL multi-batch dataset for developing the analytics dashboard locally.
 *
 * Every company, student, roll number and package here is invented. All records use the
 * "DEMO" prefix, so they are easy to recognise and remove, and the script is safe to rerun:
 * it is deterministic and upserts by primary key. A few values are deliberately left null
 * to mirror incomplete historical records. Never run this against a production database.
 *
 *   npm run db:seed:dashboard
 */
import "dotenv/config";

import { db, postgresClient } from "./index";
import { companies, placementOffers, students } from "./schema";

type Company = typeof companies.$inferInsert;
type Student = typeof students.$inferInsert;
type Offer = typeof placementOffers.$inferInsert;

const BATCHES = [2021, 2022, 2023, 2024, 2025];
const BATCH_SIZE = [64, 66, 68, 68, 70];
const PLACEMENT_CHANCE = [0.7, 0.73, 0.76, 0.76, 0.8];

// [name, sector (companies.domain), package range in LPA, relative hiring weight]
const COMPANIES: [string, string, [number, number], number][] = [
  ["DEMO Ferrous Works", "Core: steel", [8, 13], 9],
  ["DEMO Rolling Mills", "Core: steel", [7, 11], 6],
  ["DEMO Alloy Smelters", "Core: non-ferrous", [9, 15], 5],
  ["DEMO Mining Corp", "Mining", [7, 12], 4],
  ["DEMO Ceramics Ltd", "Materials", [8, 12], 3],
  ["DEMO Aero Materials", "Aerospace", [13, 20], 3],
  ["DEMO Auto Components", "Manufacturing", [6, 10], 5],
  ["DEMO Power Systems", "Energy", [9, 14], 3],
  ["DEMO Materials Research", "R&D", [10, 16], 2],
  ["DEMO Data Labs", "Analytics", [11, 18], 3],
  ["DEMO Software", "IT / Software", [8, 28], 4],
  ["DEMO Strategy Partners", "Consulting", [13, 20], 2],
  ["DEMO Capital", "Finance", [15, 26], 1],
];

const FIRST = [
  "Asha",
  "Bala",
  "Charu",
  "Dev",
  "Esha",
  "Farid",
  "Gita",
  "Hari",
  "Indu",
  "Jai",
  "Kavya",
  "Lohit",
  "Mira",
  "Nikhil",
  "Ojas",
  "Priya",
  "Ravi",
  "Sana",
  "Tara",
  "Uday",
];

/** Small seeded PRNG so the dataset is identical on every machine. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function build() {
  const random = mulberry32(1964);
  const totalWeight = COMPANIES.reduce(
    (sum, [, , , weight]) => sum + weight,
    0,
  );
  const pickCompany = () => {
    let roll = random() * totalWeight;
    for (const company of COMPANIES) {
      roll -= company[3];
      if (roll <= 0) return company;
    }
    return COMPANIES[0];
  };

  const studentRows: Student[] = [];
  const offerRows: Offer[] = [];

  BATCHES.forEach((batchYear, b) => {
    const growth = 1 + b * 0.06;
    for (let i = 1; i <= BATCH_SIZE[b]; i++) {
      const rollNumber = `DEMO-${batchYear}-${String(100 + i)}`;
      studentRows.push({
        rollNumber,
        batchYear,
        name:
          random() < 0.04
            ? null
            : `${FIRST[Math.floor(random() * FIRST.length)]} Example`,
      });
      if (random() > PLACEMENT_CHANCE[b]) continue;

      const [companyName, , [low, high]] = pickCompany();
      const typeRoll = random();
      const month = [8, 9, 10, 11, 12, 1, 2, 3][Math.floor(random() * 8)];
      const year = month >= 8 ? batchYear - 1 : batchYear;
      offerRows.push({
        companyName,
        studentRollNumber: rollNumber,
        jobRole: random() < 0.3 ? null : "Graduate Engineer",
        // Whole or half LPA, as offers are usually quoted; keeps mode CTC meaningful.
        packageLpa:
          random() < 0.05
            ? null
            : String(
                Math.round((low + random() * (high - low)) * growth * 2) / 2,
              ),
        offerType:
          typeRoll < 0.05
            ? null
            : typeRoll < 0.22
              ? "PPO"
              : typeRoll < 0.4
                ? "FTE+6month"
                : "FTE",
        offerDate:
          random() < 0.08
            ? null
            : `${year}-${String(month).padStart(2, "0")}-${String(1 + Math.floor(random() * 28)).padStart(2, "0")}`,
      });
    }
  });

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  const addDays = (days: number) => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  };
  // Demo campus visits relative to today: one already past, two on the same day.
  const VISIT_OFFSETS: Record<string, number> = {
    "DEMO Ferrous Works": -6,
    "DEMO Software": 0,
    "DEMO Data Labs": 3,
    "DEMO Aero Materials": 3,
    "DEMO Power Systems": 9,
    "DEMO Capital": 16,
  };

  const companyRows: Company[] = COMPANIES.map(([name, domain], index) => {
    const offset = VISIT_OFFSETS[name];
    return {
      name,
      domain,
      hrName: offset === undefined ? null : `HR Contact ${index + 1}`,
      email:
        offset === undefined
          ? null
          : `hr${index + 1}@${name.toLowerCase().replace(/[^a-z]+/g, "")}.example.com`,
      phoneNumber:
        offset === undefined
          ? null
          : `+91 98000 0${String(index + 10).padStart(4, "0")}`,
      pvrStatus: null,
      visitDate: offset === undefined ? null : addDays(offset),
    };
  });

  return { companyRows, studentRows, offerRows };
}

async function seed() {
  const { companyRows, studentRows, offerRows } = build();

  await db.transaction(async (transaction) => {
    for (const company of companyRows) {
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
            visitDate: company.visitDate,
          },
        });
    }
    for (const student of studentRows) {
      await transaction
        .insert(students)
        .values(student)
        .onConflictDoUpdate({
          target: students.rollNumber,
          set: { name: student.name, batchYear: student.batchYear },
        });
    }
    for (const offer of offerRows) {
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
    `Seeded ${companyRows.length} companies, ${studentRows.length} students and ${offerRows.length} offers across batches ${BATCHES.join(", ")} (all fictional, DEMO-prefixed).`,
  );
}

async function main() {
  try {
    await seed();
  } catch (error) {
    console.error("Failed to seed the dashboard demo data.", error);
    process.exitCode = 1;
  } finally {
    await postgresClient.end();
  }
}

void main();
