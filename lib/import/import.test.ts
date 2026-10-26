import assert from "node:assert/strict";
import test from "node:test";
import { CsvError, parseTemplateCsv } from "./csv";
import { duplicateKey, rowProblem } from "./row-rules";
import { mayImport, previewToken, validPreviewToken } from "./security";
import { IMPORT_KINDS, TEMPLATES, templateCsv } from "./templates";
import ExcelJS from "exceljs";
import { templateWorkbook, workbookToCsv } from "./workbook";

test("all downloadable templates have exact ordered headers and no example rows", () => {
  for (const kind of IMPORT_KINDS) {
    assert.equal(templateCsv(kind), `${TEMPLATES[kind].columns.join(",")}\r\n`);
    assert.deepEqual(parseTemplateCsv(kind, templateCsv(kind)), []);
  }
});

test("CSV accepts quoted values but rejects malformed headers, missing and extra columns", () => {
  const header = templateCsv("companies").trim();
  assert.deepEqual(parseTemplateCsv("companies", `${header}\n"Example, Inc.","A ""quoted"" description",\n`)[0].values,
    { company_name: "Example, Inc.", description: 'A "quoted" description', remarks: "" });
  assert.throws(() => parseTemplateCsv("companies", "name,description,remarks\nAcme,,\n"), CsvError);
  assert.throws(() => parseTemplateCsv("companies", "company_name,description\nAcme,Test\n"), CsvError);
  assert.throws(() => parseTemplateCsv("companies", `${header}\nAcme,Test,Notes,extra\n`), /expected 3 columns/);
  assert.throws(() => parseTemplateCsv("companies", `${header}\nAcme,,\n,,\n`), /blank data rows/);
  assert.throws(() => parseTemplateCsv("companies", `${header}\n\n`), /expected 3 columns/);
  assert.throws(() => parseTemplateCsv("companies", `${header}\n"unclosed\n`), /unclosed quoted/);
});

test("Excel templates keep examples outside data and reject changed workbook structure", async () => {
  const downloaded = await templateWorkbook("companies");
  assert.equal(await workbookToCsv("companies", downloaded), templateCsv("companies"));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(downloaded as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  workbook.getWorksheet("companies")!.addRow(["Example Ltd", "", ""]);
  const valid = Buffer.from(await workbook.xlsx.writeBuffer());
  assert.deepEqual(parseTemplateCsv("companies", await workbookToCsv("companies", valid))[0].values,
    { company_name: "Example Ltd", description: "", remarks: "" });
  workbook.getWorksheet("companies")!.getCell("A1").value = "name";
  await assert.rejects(workbookToCsv("companies", Buffer.from(await workbook.xlsx.writeBuffer())), /Incorrect companies header/);
  workbook.getWorksheet("companies")!.getCell("A1").value = "company_name";
  workbook.getWorksheet("companies")!.addRow(["", "", "", "unexpected"]);
  await assert.rejects(workbookToCsv("companies", Buffer.from(await workbook.xlsx.writeBuffer())), /exactly 3 columns/);
  workbook.getWorksheet("companies")!.spliceRows(3, 1);
  workbook.addWorksheet("Unrecognized");
  await assert.rejects(workbookToCsv("companies", Buffer.from(await workbook.xlsx.writeBuffer())), /Unsupported worksheet/);
});

test("invalid values, missing required cells, and duplicate stable keys are rejected", () => {
  const valid = parseTemplateCsv("students", `${templateCsv("students")}987654321,Example Student,mme,B.Tech,,2027,2023,,,C-2027,REGISTERED\n`)[0];
  assert.equal(rowProblem("students", valid), null);
  const badYear = { ...valid, values: { ...valid.values, graduation_year: "27" } };
  assert.match(rowProblem("students", badYear)!, /four-digit/);
  const missingRegistration = { ...valid, values: { ...valid.values, registration_status: "" } };
  assert.match(rowProblem("students", missingRegistration)!, /required/);
  const badStatus = { ...valid, values: { ...valid.values, registration_status: "UNKNOWN" } };
  assert.match(rowProblem("students", badStatus)!, /REGISTERED/);
  const badRoll = { ...valid, values: { ...valid.values, roll_number: "012345678" } };
  assert.match(rowProblem("students", badRoll)!, /nine digits/);
  const longCompany = parseTemplateCsv("companies", `${templateCsv("companies")}${"A".repeat(201)},,\n`)[0];
  assert.match(rowProblem("companies", longCompany)!, /1–200 characters/);
  assert.equal(duplicateKey("students", valid), duplicateKey("students", { ...valid, line: 3 }));
});

test("offer and cycle value constraints reject invalid dates, types, amounts and role without drive", () => {
  const offer = parseTemplateCsv("offers", `${templateCsv("offers")}987654321,C-2027,Example Ltd,,,12.5,,FTE,2026-12-01\n`)[0];
  assert.equal(rowProblem("offers", offer), null);
  assert.match(rowProblem("offers", { ...offer, values: { ...offer.values, package_lpa: "-1" } })!, /nonnegative/);
  assert.match(rowProblem("offers", { ...offer, values: { ...offer.values, offer_type: "PPO+FTE" } })!, /offer_type/);
  assert.match(rowProblem("offers", { ...offer, values: { ...offer.values, role_id: "abc" } })!, /requires drive_id/);
  assert.match(rowProblem("offers", { ...offer, values: { ...offer.values, offer_date: "2027-02-30" } })!, /real/);
  const cycle = parseTemplateCsv("cycles", `${templateCsv("cycles")}C-2027,2027-06-30,2026-08-01\n`)[0];
  assert.match(rowProblem("cycles", cycle)!, /on or before/);
});

test("only administrators with a selected department may import; preview token is bound and expires", () => {
  assert.equal(mayImport("PROFESSOR", "dept"), false);
  assert.equal(mayImport("ADMIN", null), false);
  assert.equal(mayImport("SUPERADMIN", "dept"), true);
  const token = previewToken("test-secret", 1000, "user", "dept", "students", "digest");
  assert.equal(validPreviewToken("test-secret", token, 1001, "user", "dept", "students", "digest"), true);
  assert.equal(validPreviewToken("test-secret", token, 1001, "other", "dept", "students", "digest"), false);
  assert.equal(validPreviewToken("test-secret", token, 1001, "user", "dept", "offers", "digest"), false);
  assert.equal(validPreviewToken("test-secret", token, 601001, "user", "dept", "students", "digest"), false);
});
