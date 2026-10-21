/**
 * One-purpose import for the MME 2027 batch roster.
 *
 * Dry run: npx tsx db/seed-mme-2027-roster.ts --dry-run
 * Import:  npx tsx db/seed-mme-2027-roster.ts
 *
 * This script creates student rows only. Existing rows are never changed.
 */
import "dotenv/config";

import { count, inArray, sql } from "drizzle-orm";

import { db, postgresClient } from "./index";
import { students } from "./schema";

const BATCH_YEAR = 2027;

const SOURCE_ROSTER = [
  [112123001, "AARYA V"],
  [112123002, "ABHAY M"],
  [112123003, "ABINAYA ILANGOVAN"],
  [112123004, "AERRA SUMANTH"],
  [112123005, "A HAKEEM MOHAMED"],
  [112123006, "AHLADITA TUDUKU"],
  [112123007, "AKSHAY BANKAR"],
  [112123008, "ANURAG KHARWAR"],
  [112123009, "ARJITH JP"],
  [112123010, "ARJUN VENKATESH PRAKASH"],
  [112123011, "ARYAN DEVESH"],
  [112123012, "BAVIN I"],
  [112123013, "BHUKYA SURESH"],
  [112123014, "BIBIYAN JOHN JOSEPH G"],
  [112123015, "BISHAKHA NEOGY"],
  [112123016, "BOBBY RAJ"],
  [112123017, "CHIDAMBARA NATARAJAN S"],
  [112123018, "DEV JYOTI MAHATO"],
  [112123019, "DHANANJEYAN M"],
  [112123020, "DHRUV YADAV"],
  [112123021, "E SETHURAMA SUBRAMANIAM"],
  [112123022, "FELCIA MARY J"],
  [112123023, "GANDHAM SRI VASISTA"],
  [112123024, "GANDI RAAM P U"],
  [112123025, "GARAPATI RAJU"],
  [112123026, "GARVIT"],
  [112123027, "GIDDALURU SURYA VARDHAN"],
  [112123028, "HARISH K"],
  [112123029, "HARSHINI S"],
  [112123030, "HARSH KUMAR"],
  [112123031, "IBRAHIM T"],
  [112123032, "JAGU RESHMA"],
  [112123033, "KAMALI G"],
  [112123034, "KEDARNATH SRIVATSA"],
  [112123035, "KISHLAY KUMAR"],
  [112123036, "KRISHNADUTT SATHISH"],
  [112123037, "KRISHNA R MUDHOL"],
  [112123038, "KRISTAN A"],
  [112123039, "KUMARAN V"],
  [112123040, "KUNAL RAJ"],
  [112123041, "LAKSHYA SAXENA"],
  [112123042, "M AKASH"],
  [112123043, "MD ADIBUL ASAR"],
  [112123044, "MONA M S"],
  [112123045, "MOODU NARASIMHA SWAMI"],
  [112123046, "MURSHID KHALILUR RAHMAN"],
  [112123047, "OSHO RAVINDRA SONWANE"],
  [112123048, "PANKAJ KUMAR"],
  [112123049, "PRANESH S K"],
  [112123050, "P SRIKANTH"],
  [112123051, "RAJ BURNWAL"],
  [112123052, "RAJESH S"],
  [112123053, "RAKSHITHA R A"],
  [112123054, "RAVI KUMAR"],
  [112123055, "REMASRI S"],
  [112123056, "RESHU PATHAK"],
  [112123057, "RILA IRFAN"],
  [112123058, "RISHABH YADAV"],
  [112123059, "RITHIKA B"],
  [112123060, "RITIK ROSHAN"],
  [112123061, "RIYA DAWRA"],
  [112123062, "R P S YUGESH"],
  [112123063, "SAJJA AKSHITH"],
  [112123064, "SAKTIKANTA BARAL"],
  [112123065, "SAMYUKTHA SREE T"],
  [112123066, "SANDIP KARTHICK S"],
  [112123067, "SHREE VAISHNAVI G"],
  [112123068, "SILLA RAHUL"],
  [112123069, "SIMON GERARD SCURVILLE"],
  [112123070, "SOHAM SINGH CHOUHAN"],
  [112123071, "SRISANTH J"],
  [112123072, "SUBHRADEEP DEY"],
  [112123073, "SWASTHIKA M"],
  [112123074, "TANISHA NARASIMMAN"],
  [112123075, "TARUNI SRINIVAS"],
  [112123076, "VAIBHAV KANNAN"],
  [112123077, "VARSHA N"],
  [112123078, "VEERAM REDDY MOUNIKA"],
  [112123079, "VENGATESHWARAN S"],
  [112123080, "V SHIYAM"],
] as const;

function formatName(sourceName: string): string {
  return sourceName
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) =>
      part.length <= 2
        ? part.toUpperCase()
        : `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`,
    )
    .join(" ");
}

function validatedRoster() {
  if (SOURCE_ROSTER.length !== 80) {
    throw new Error(`Expected exactly 80 rows; found ${SOURCE_ROSTER.length}.`);
  }

  const rows = SOURCE_ROSTER.map(([rollNumber, sourceName]) => ({
    rollNumber,
    name: formatName(sourceName),
    batchYear: BATCH_YEAR,
  }));
  const duplicateRolls = rows
    .filter(
      (row, index) =>
        rows.findIndex((candidate) => candidate.rollNumber === row.rollNumber) !==
        index,
    )
    .map((row) => row.rollNumber);

  if (duplicateRolls.length > 0) {
    throw new Error(`Duplicate roll numbers: ${[...new Set(duplicateRolls)].join(", ")}.`);
  }
  for (const row of rows) {
    if (!/^\d{9}$/.test(String(row.rollNumber))) {
      throw new Error(`Roll number must contain exactly nine digits: ${row.rollNumber}.`);
    }
    if (!row.name) {
      throw new Error(`Student name is empty for roll number ${row.rollNumber}.`);
    }
  }
  return rows;
}

async function inspectExisting(rows: ReturnType<typeof validatedRoster>) {
  const existing = await db
    .select({
      rollNumber: students.rollNumber,
      name: students.name,
      batchYear: students.batchYear,
    })
    .from(students)
    .where(
      inArray(
        students.rollNumber,
        rows.map((row) => row.rollNumber),
      ),
    );
  const desiredByRoll = new Map<number, (typeof rows)[number]>(
    rows.map((row) => [row.rollNumber, row]),
  );
  const conflicts = existing.filter((row) => {
    const desired = desiredByRoll.get(row.rollNumber);
    return !desired || row.name !== desired.name || row.batchYear !== desired.batchYear;
  });
  if (conflicts.length > 0) {
    throw new Error(
      `Existing student records conflict at roll numbers: ${conflicts
        .map((row) => row.rollNumber)
        .join(", ")}. No rows were changed.`,
    );
  }
  const existingRolls = new Set(existing.map((row) => row.rollNumber));
  return {
    existing,
    missing: rows.filter((row) => !existingRolls.has(row.rollNumber)),
  };
}

async function dryRun(rows: ReturnType<typeof validatedRoster>) {
  const { existing, missing } = await inspectExisting(rows);
  for (const row of missing) {
    console.log(`${row.rollNumber},${row.name}`);
  }
  const [{ total }] = await db.select({ total: count() }).from(students);
  console.log(`Would insert: ${missing.length}`);
  console.log(`Would update: 0`);
  console.log(`Would skip: ${existing.length}`);
  console.log(`Projected total students: ${total + missing.length}`);
}

async function importRoster(rows: ReturnType<typeof validatedRoster>) {
  const summary = await db.transaction(async (transaction) => {
    // Prevent another student write from racing the conflict check and insert.
    await transaction.execute(
      sql`lock table ${students} in share row exclusive mode`,
    );
    const existing = await transaction
      .select({
        rollNumber: students.rollNumber,
        name: students.name,
        batchYear: students.batchYear,
      })
      .from(students)
      .where(
        inArray(
          students.rollNumber,
          rows.map((row) => row.rollNumber),
        ),
      );
    const desiredByRoll = new Map<number, (typeof rows)[number]>(
      rows.map((row) => [row.rollNumber, row]),
    );
    const conflicts = existing.filter((row) => {
      const desired = desiredByRoll.get(row.rollNumber);
      return !desired || row.name !== desired.name || row.batchYear !== desired.batchYear;
    });
    if (conflicts.length > 0) {
      throw new Error(
        `Existing student records conflict at roll numbers: ${conflicts
          .map((row) => row.rollNumber)
          .join(", ")}. No rows were changed.`,
      );
    }

    const existingRolls = new Set(existing.map((row) => row.rollNumber));
    const missing = rows.filter((row) => !existingRolls.has(row.rollNumber));
    if (missing.length > 0) {
      await transaction.insert(students).values(missing);
    }
    const [{ total }] = await transaction
      .select({ total: count() })
      .from(students);
    return {
      inserted: missing.length,
      updated: 0,
      skipped: existing.length,
      total,
    };
  });

  console.log(`Rows inserted: ${summary.inserted}`);
  console.log(`Rows updated: ${summary.updated}`);
  console.log(`Rows skipped: ${summary.skipped}`);
  console.log(`Total students: ${summary.total}`);
}

async function main() {
  const unknownArguments = process.argv.slice(2).filter((arg) => arg !== "--dry-run");
  if (unknownArguments.length > 0) {
    throw new Error(`Unknown argument: ${unknownArguments.join(" ")}.`);
  }
  const rows = validatedRoster();
  if (process.argv.includes("--dry-run")) {
    await dryRun(rows);
  } else {
    await importRoster(rows);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Roster import failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgresClient.end();
  });
