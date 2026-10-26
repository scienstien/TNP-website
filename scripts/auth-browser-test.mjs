/** Browser smoke test against an explicitly isolated, fictional auth database. */
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

assert.equal(process.env.AUTH_BROWSER_ISOLATED, "true", "Point the app at an isolated fictional database before running.");
const base = process.env.AUTH_BROWSER_BASE_URL ?? "http://127.0.0.1:3106";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(path.join(modulePath, "index.mjs")).href : "playwright");
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE });
const password = process.env.AUTH_BROWSER_PASSWORD;
assert.ok(password, "Set AUTH_BROWSER_PASSWORD for the fictional fixture accounts.");

async function signIn(email) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  await page.getByLabel("Email or username").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/", { timeout: 30000 });
  return { context, page };
}

try {
  const anonymous = await browser.newPage();
  await anonymous.goto(`${base}/students/ug`);
  await anonymous.waitForURL(url => url.pathname === "/login");
  await anonymous.close();
  console.log("PASS anonymous redirect");

  const admin = await signIn("qa-admin@example.invalid");
  const selector = admin.page.getByRole("combobox", { name: "Department" });
  assert.equal(await selector.inputValue(), "all");
  await admin.page.goto(`${base}/students/ug`);
  await admin.page.getByText("Choose a department in the bar above").waitFor();
  await admin.page.goto(`${base}/companies`);
  assert.equal(await admin.page.getByRole("button", { name: "Add company" }).count(), 0);
  assert.equal((await admin.page.request.get(`${base}/api/import/references`)).status(), 400);
  assert.match((await (await admin.page.request.post(`${base}/api/import`, { headers: { origin: base } })).json()).error, /Choose one department/);
  console.log("PASS ADMIN all-department read-only state");

  for (const code of ["civil", "mme"]) {
    await admin.page.getByRole("combobox", { name: "Department" }).selectOption(code);
    await admin.page.waitForFunction(expected => document.querySelector('select[aria-label="Department"]')?.value === expected && document.querySelector('.dept-navbar')?.getAttribute('aria-busy') === 'false', code);
    await admin.page.goto(`${base}/students/ug`);
    await admin.page.getByRole("combobox", { name: "Department" }).waitFor();
    assert.equal(await admin.page.getByRole("combobox", { name: "Department" }).inputValue(), code);
    assert.equal(await admin.page.getByText("Choose a department in the bar above").count(), 0);
    assert.equal((await admin.page.request.get(`${base}/api/import/references`)).status(), 200);
    assert.match((await (await admin.page.request.post(`${base}/api/import`, { headers: { origin: base } })).json()).error, /Expected a CSV or Excel upload/);
  }
  console.log("PASS ADMIN selects and reads two departments");
  await admin.page.getByRole("button", { name: "Sign out" }).click();
  await admin.page.waitForURL(url => url.pathname === "/login");
  await admin.page.goto(`${base}/login`);
  await admin.page.getByLabel("Email or username").fill("qa-admin@example.invalid");
  await admin.page.getByLabel("Password", { exact: true }).fill(password);
  await admin.page.getByRole("button", { name: "Sign in", exact: true }).click();
  await admin.page.waitForURL(url => url.pathname === "/");
  assert.equal(await admin.page.getByRole("combobox", { name: "Department" }).inputValue(), "all");
  console.log("PASS sign-out");
  await admin.context.close();

  const professor = await signIn("qa-professor@example.invalid");
  assert.equal(await professor.page.getByRole("combobox", { name: "Department" }).isDisabled(), true);
  assert.equal((await professor.page.request.get(`${base}/api/import/references`)).status(), 403);
  assert.equal((await professor.page.request.post(`${base}/api/import`, { headers: { origin: base } })).status(), 403);
  const deniedStudentPage = await professor.page.goto(`${base}/students/ug`);
  assert.equal(deniedStudentPage?.status(), 404);
  assert.equal(professor.page.url().includes("/students/ug"), true);
  await professor.page.getByText("Not Found").first().waitFor();
  console.log("PASS PROFESSOR remains scoped and read-only");
  await professor.context.close();

  const superadmin = await signIn("qa-superadmin@example.invalid");
  assert.equal(await superadmin.page.getByRole("combobox", { name: "Department" }).inputValue(), "all");
  await superadmin.context.close();
  console.log("PASS SUPERADMIN sign-in");
} finally {
  await browser.close();
}
