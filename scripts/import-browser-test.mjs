/**
 * Browser acceptance for the official import workflow, using fictional records only.
 * Run against the isolated PostgreSQL fixture prepared by database.integration.test.ts.
 * IMPORT_BROWSER_BASE_URL must point to its locally running application, with real
 * auth enabled. Set PLAYWRIGHT_MODULE to an installed playwright package when it is
 * not installed in this repository. This script never connects to PostgreSQL.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(path.join(process.env.PLAYWRIGHT_MODULE, "index.mjs")).href
  : "playwright");

const baseUrl = process.env.IMPORT_BROWSER_BASE_URL || "http://127.0.0.1:3105";
const base = new URL(baseUrl);
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "Use a local isolated test website.");
assert.equal(process.env.IMPORT_BROWSER_ISOLATED, "true", "Confirm the website uses an isolated fictional test database.");
const run = process.env.IMPORT_BROWSER_RUN || String(Date.now());
const artifactDir = process.env.IMPORT_BROWSER_ARTIFACTS || `/tmp/tnp-import-browser-${run}`;
const password = process.env.IMPORT_BROWSER_PASSWORD || "ImportQaPass123!";
const company = `Browser Import QA ${run}`;
const historic = `BROWSER-QA-${run}-HISTORIC`;
const current = `BROWSER-QA-${run}-CURRENT`;
const rollBase = Number(process.env.IMPORT_BROWSER_ROLL_BASE || String(988800000 + Math.floor(Math.random() * 24999) * 4));
assert.ok(rollBase >= 988800000 && rollBase <= 988899996, "Use the reserved fictional browser roll range.");
const rolls = [0, 1, 2, 3].map(offset => rollBase + offset);
const evidence = { run, baseUrl, company, historic, current, rolls, checks: [], reports: [] };
const csvHeaders = {
  companies: "company_name,description,remarks",
  cycles: "cycle_code,starts_on,ends_on",
  cohorts: "department_code,degree_code,specialization,graduation_year",
  students: "roll_number,student_name,department_code,degree_code,specialization,graduation_year,admission_year,gender_code,reservation_category_code,cycle_code,registration_status",
  offers: "roll_number,cycle_code,company_name,drive_id,role_id,package_lpa,monthly_stipend_inr,offer_type,offer_date",
};
const source = (kind, rows) => `${csvHeaders[kind]}\r\n${rows.join("\r\n")}\r\n`;
const inputFile = (kind, text) => ({ name: `${kind}.csv`, mimeType: "text/csv", buffer: Buffer.from(text) });
const check = (label, detail) => { evidence.checks.push({ label, detail }); console.log(`PASS ${label}`); };

async function login(browser, email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  await page.goto(`${baseUrl}/login?callbackUrl=/admin/data-management`);
  await page.getByLabel("Email or username").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 90000 });
  await page.goto(`${baseUrl}/admin/data-management`);
  return { context, page };
}

async function upload(page, kind, text) {
  return uploadFile(page, kind, inputFile(kind, text));
}

async function uploadFile(page, kind, file) {
  await page.locator("#import-kind").selectOption(kind);
  await page.locator("#import-file").setInputFiles(file);
  const responsePromise = page.waitForResponse(response => response.url() === `${baseUrl}/api/import` && response.request().method() === "POST");
  await page.getByRole("button", { name: "Validate and preview", exact: true }).click();
  const response = await responsePromise;
  const report = await response.json();
  evidence.reports.push({ kind, phase: "preview", status: response.status(), report });
  return report;
}

async function confirm(page, kind) {
  const responsePromise = page.waitForResponse(response => response.url() === `${baseUrl}/api/import` && response.request().method() === "POST");
  await page.getByRole("button", { name: "Confirm import", exact: true }).click();
  const response = await responsePromise;
  const report = await response.json();
  evidence.reports.push({ kind, phase: "confirm", status: response.status(), report });
  assert.equal(response.status(), 200, JSON.stringify(report));
  assert.equal(report.committed, true, JSON.stringify(report));
  await page.getByText(/Import complete|Import saved/).first().waitFor();
  return report;
}

async function reject(page, kind, text, expression) {
  const report = await upload(page, kind, text);
  assert.notEqual(report.committed, true);
  assert.match(JSON.stringify(report), expression);
  assert.equal(await page.getByRole("button", { name: "Confirm import", exact: true }).count(), 0);
  check(`Reject ${expression.source}`);
}

async function main() {
  await fs.mkdir(artifactDir, { recursive: true });
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
  try {
    const { context, page } = await login(browser, "import-admin@nitt.edu");
    await page.getByRole("heading", { name: "Admin Data Management" }).waitFor();
    check("Administrator opens Data Management with real authentication");

    for (const kind of Object.keys(csvHeaders)) {
      const response = await context.request.get(`${baseUrl}/api/import/templates/${kind}`);
      assert.equal(response.status(), 200);
      assert.equal((await response.text()).replace(/^\uFEFF/, ""), `${csvHeaders[kind]}\r\n`);
    }
    const downloadPromise = page.waitForEvent("download");
    await page.locator('a[href="/api/import/templates/companies"]').click();
    const download = await downloadPromise;
    await download.saveAs(path.join(artifactDir, download.suggestedFilename()));
    check("Every CSV template has exact headers and the page download link works");

    await reject(page, "companies", "company,description,remarks\nWrong header,,\n", /header/i);
    await reject(page, "students", "roll_number,student_name\n988800099,Bad Row\n", /header/i);
    await reject(page, "companies", source("companies", [`${company},,`, `${company},,`]), /Duplicate/i);
    await reject(page, "cycles", source("cycles", ["BROWSER-INVALID,2026-02-30,"]), /date/i);
    await reject(page, "students", source("students", [`988800099,Browser Invalid,mme,B.Tech,,2027,2023,,,NO-SUCH-CYCLE,REGISTERED`]), /cycle/i);
    await reject(page, "companies", source("companies", [",Missing name,"]), /required/i);

    for (const [kind, text, inserted] of [
      ["companies", source("companies", [`${company},Fictional browser validation company,Isolated test data`]), 1],
      ["cycles", source("cycles", [`${historic},2006-08-01,2007-06-30`, `${current},2026-08-01,2027-06-30`]), 2],
      ["cohorts", source("cohorts", ["mme,B.Tech,,2007"]), 1],
      ["students", source("students", [
        `${rolls[0]},Browser Historic Student,mme,B.Tech,,2007,2003,,,${historic},REGISTERED`,
        `${rolls[1]},Browser Placed Student,mme,B.Tech,,2027,2023,,,${current},REGISTERED`,
        `${rolls[2]},Browser Unplaced Student,mme,B.Tech,,2027,2023,,,${current},REGISTERED`,
        `${rolls[3]},Browser Unregistered Student,mme,B.Tech,,2027,2023,,,${current},UNREGISTERED`,
      ]), 4],
      ["offers", source("offers", [
        `${rolls[0]},${historic},${company},,,8,,FTE,2007-01-01`,
        `${rolls[1]},${current},${company},,,12.5,,FTE,2026-10-01`,
      ]), 2],
    ]) {
      const report = await upload(page, kind, text);
      assert.equal(report.committed, false);
      assert.deepEqual(report.errors, []);
      assert.equal(kind === "cohorts" ? report.inserted + report.skipped : report.inserted, inserted);
      await page.getByRole("button", { name: "Confirm import", exact: true }).waitFor();
      await page.screenshot({ path: path.join(artifactDir, `${kind}-preview.png`), fullPage: true });
      const committed = await confirm(page, kind);
      assert.equal(kind === "cohorts" ? committed.inserted + committed.skipped : committed.inserted, inserted);
      check(`${kind}: preview then explicit confirm`, { inserted });
    }

    const replay = await upload(page, "offers", source("offers", [
      `${rolls[1]},${current},${company},,,12.50,,FTE,2026-10-01`,
    ]));
    assert.equal(replay.skipped, 1);
    assert.equal(replay.inserted, 0);
    await confirm(page, "offers");
    check("Reimporting the same final offer skips it without duplication");

    const update = await upload(page, "companies", source("companies", [
      `${company},Fictional browser validation company,Updated after browser review`,
    ]));
    assert.equal(update.updated, 1);
    assert.deepEqual(update.errors, []);
    await confirm(page, "companies");
    check("Company update is previewed and committed explicitly");

    const { default: ExcelJS } = await import("exceljs");
    const excelResponse = await context.request.get(`${baseUrl}/api/import/templates/companies?format=xlsx`);
    assert.equal(excelResponse.status(), 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await excelResponse.body());
    assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ["companies", "Instructions", "Examples"]);
    workbook.getWorksheet("companies").addRow([company, "Fictional browser validation company", "Updated after browser review"]);
    const xlsxFile = async book => ({ name: "companies.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await book.xlsx.writeBuffer()) });
    const excelPreview = await uploadFile(page, "companies", await xlsxFile(workbook));
    assert.deepEqual(excelPreview.errors, []);
    assert.equal(excelPreview.skipped, 1);
    assert.equal(excelPreview.rows.length, 1, "Examples and Instructions must not become real rows.");
    await confirm(page, "companies");
    check("XLSX template roundtrip accepts the data sheet and excludes Examples/Instructions");

    workbook.getWorksheet("companies").name = "wrong_worksheet";
    const invalidWorkbook = await uploadFile(page, "companies", await xlsxFile(workbook));
    assert.match(JSON.stringify(invalidWorkbook), /worksheet/i);
    assert.notEqual(invalidWorkbook.committed, true);
    assert.equal(await page.getByRole("button", { name: "Confirm import", exact: true }).count(), 0);
    check("Incorrect Excel worksheet is rejected");

    await page.goto(`${baseUrl}/students/ug`);
    await page.getByPlaceholder("Search name, roll number, cycle or company").fill(String(rolls[0]));
    await page.getByText("Browser Historic Student", { exact: true }).first().waitFor();
    assert.match(await page.locator("main").last().innerText(), /2007/);
    await page.screenshot({ path: path.join(artifactDir, "historical-student-visible.png"), fullPage: true });
    await page.getByPlaceholder("Search name, roll number, cycle or company").fill(String(rolls[1]));
    await page.getByText("Browser Placed Student", { exact: true }).first().waitFor();
    assert.match(await page.locator("main").last().innerText(), new RegExp(company));
    check("Student Records shows imported current and preserved historical students with offers");

    await page.goto(`${baseUrl}/dashboard/ug`);
    const dashboardFilters = page.getByRole("region", { name: "Dashboard filters" });
    await dashboardFilters.waitFor();
    await dashboardFilters.locator("select").nth(0).selectOption({ label: current });
    await dashboardFilters.locator("select").nth(1).selectOption({ label: historic });
    const kpis = page.getByRole("region", { name: "Key figures" });
    await kpis.waitFor();
    const card = label => kpis.locator("article").filter({ has: page.getByText(label, { exact: true }) });
    assert.equal(await card("Registered students").locator("strong").innerText(), "2");
    assert.equal(await card("Placed students").locator("strong").innerText(), "1");
    assert.equal(await card("Unplaced students").locator("strong").innerText(), "1");
    assert.match(await card("Placed students").innerText(), /50/);
    assert.match(await kpis.innerText(), new RegExp(historic));
    await page.screenshot({ path: path.join(artifactDir, "dashboard-comparison.png"), fullPage: true });
    evidence.dashboard = await kpis.innerText();
    check("Dashboard shows registered=2, placed=1, unplaced=1, 50%, and historical comparison");

    await page.goto(`${baseUrl}/admin/data-management`);
    const history = await page.locator("main").last().innerText();
    assert.match(history, /Recent imports/);
    assert.match(history, /offers/);
    await page.screenshot({ path: path.join(artifactDir, "import-history.png"), fullPage: true });
    check("Confirmed imports appear in history");

    const professor = await login(browser, "import-professor@nitt.edu");
    const denied = await professor.context.request.post(`${baseUrl}/api/import`, {
      headers: { Origin: baseUrl },
      multipart: { kind: "companies", mode: "preview", file: inputFile("companies", source("companies", ["Browser Forbidden,,"])) },
    });
    assert.equal(denied.status(), 403);
    assert.equal((await professor.context.request.get(`${baseUrl}/api/import/templates/companies`)).status(), 403);
    check("Professor cannot upload or download administrative templates");
    await professor.context.close();

    const superadmin = await login(browser, "import-superadmin@nitt.edu");
    await superadmin.context.addCookies([{ name: "tnp-department", value: "all", url: baseUrl }]);
    await superadmin.page.goto(`${baseUrl}/admin/data-management`);
    await superadmin.page.getByText(/Choose one department/).first().waitFor();
    const allDenied = await superadmin.context.request.post(`${baseUrl}/api/import`, {
      headers: { Origin: baseUrl },
      multipart: { kind: "companies", mode: "preview", file: inputFile("companies", source("companies", ["Browser All Forbidden,,"])) },
    });
    assert.ok([400, 403].includes(allDenied.status()));
    check("SUPERADMIN All departments cannot import");
    await superadmin.context.close();

    const anonymous = await browser.newContext();
    const anon = await anonymous.request.post(`${baseUrl}/api/import`, {
      headers: { Origin: baseUrl },
      maxRedirects: 0,
      multipart: { kind: "companies", mode: "preview", file: inputFile("companies", source("companies", ["Browser Anonymous Forbidden,,"])) },
    });
    assert.ok([401, 302, 303, 307].includes(anon.status()));
    check("Anonymous upload is rejected before importing");
    await anonymous.close();
    await context.close();
  } finally {
    await fs.writeFile(path.join(artifactDir, "evidence.json"), JSON.stringify(evidence, null, 2));
    await browser.close();
    console.log(`Evidence: ${artifactDir}`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
