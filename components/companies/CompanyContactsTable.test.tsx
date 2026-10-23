import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { CompanyContactsTableProps } from "./CompanyContactsTable";

// tsx cannot load CSS modules; stub them (class name = key) before requiring the component.
require.extensions[".css"] = (cssModule) => {
  cssModule.exports = new Proxy({}, { get: (_, key) => (key === "__esModule" ? false : String(key)) });
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: CompanyContactsTable } = require("./CompanyContactsTable") as typeof import("./CompanyContactsTable");

// Compile-time guard: global contacts must not depend on a cycle or drive selection.
type SelectionKeys = Extract<keyof CompanyContactsTableProps, "cycle" | "cycleId" | "drive" | "driveId" | "selectedDriveId">;
const contactsIgnoreSelection: [SelectionKeys] extends [never] ? true : false = true;

const company = { companyId: "10000000-0000-4000-8000-000000000001", name: "Fictional Alloys", hrName: "Test Recruiter", phoneNumber: "+91 90000 00001", email: "hr@fictional-alloys.example" };
const render = (overrides: Partial<CompanyContactsTableProps> = {}) =>
  renderToStaticMarkup(<CompanyContactsTable company={company} loading={false} error={null} onRetry={() => {}} {...overrides} />);
const count = (html: string, needle: string) => html.split(needle).length - 1;
const headers = (html: string) => [...html.matchAll(/<th(?:\s[^>]*)?>(.*?)<\/th>/g)].map(match => match[1]);

test("the card is labelled global and has exactly HR name, Contact number and Email columns", () => {
  const html = render();
  assert.ok(html.includes("Company contacts (global)"));
  assert.deepEqual(headers(html), ["HR name", "Contact number", "Email"]);
  assert.equal(count(html, "<tr"), 2, "one header row and one contact row");
});

test("each recorded global value is shown once, with a mailto link for email", () => {
  const html = render();
  assert.equal(count(html, ">Test Recruiter<"), 1);
  assert.equal(count(html, ">+91 90000 00001<"), 1);
  assert.equal(count(html, `<a href="mailto:hr@fictional-alloys.example">hr@fictional-alloys.example</a>`), 1);
  assert.equal(count(html, "Not recorded"), 0);
});

test("missing, blank and partial fields show Not recorded without inventing values", () => {
  const partial = render({ company: { ...company, hrName: null, phoneNumber: "   " } });
  assert.equal(count(partial, "Not recorded"), 2);
  assert.ok(partial.includes("mailto:hr@fictional-alloys.example"));
  assert.ok(!partial.includes("No global HR contact"));

  const empty = render({ company: { ...company, hrName: null, phoneNumber: null, email: null } });
  assert.equal(count(empty, "Not recorded"), 3);
  assert.ok(!empty.includes("mailto:"));
  assert.ok(empty.includes("No global HR contact is recorded for Fictional Alloys."));
});

test("long values are rendered in full inside the scrollable region", () => {
  const hrName = "Recruiter ".repeat(10).trim();
  const email = `${"a".repeat(64)}@${"long-subdomain.".repeat(10)}example`;
  const html = render({ company: { ...company, hrName, email } });
  assert.ok(html.includes(`>${hrName}<`));
  assert.ok(html.includes(`>${email}</a>`));
  assert.ok(html.includes(`role="region"`));
});

test("loading and errors never show the previous company's contacts", () => {
  const loading = render({ loading: true, error: "stale error" });
  assert.ok(loading.includes("Loading company contacts"));
  assert.ok(loading.includes(`aria-busy="true"`));
  assert.ok(!loading.includes("Test Recruiter") && !loading.includes("<table") && !loading.includes("stale error"));

  const failed = render({ error: "Network unavailable" });
  assert.ok(failed.includes(`role="alert"`) && failed.includes("Network unavailable") && failed.includes(">Retry</button>"));
  assert.ok(!failed.includes("Test Recruiter") && !failed.includes("<table"));

  const failedWithoutCompany = render({ company: null, error: "" });
  assert.ok(failedWithoutCompany.includes("Company contacts could not be loaded."));
  assert.ok(!failedWithoutCompany.includes("Select a company"));
});

test("no company selected shows a prompt, not an empty table", () => {
  const html = render({ company: null });
  assert.ok(html.includes("Select a company to see its global HR contact."));
  assert.ok(!html.includes("<table") && !html.includes("Not recorded"));
});

test("contacts depend only on the company record, so switching company replaces them", () => {
  assert.equal(contactsIgnoreSelection, true);
  assert.equal(render(), render(), "same company renders the same global contact");
  const other = render({ company: { companyId: "10000000-0000-4000-8000-000000000002", name: "Fictional Polymers", hrName: "Other Recruiter", phoneNumber: null, email: "talent@fictional-polymers.example" } });
  assert.ok(other.includes("Other Recruiter") && other.includes("Fictional Polymers"));
  assert.ok(!other.includes("Test Recruiter") && !other.includes("Fictional Alloys"));
});
