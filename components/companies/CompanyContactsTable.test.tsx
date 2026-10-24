import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DriveOption } from "@/lib/drives/types";
import type { CompanyContactsTableProps } from "./CompanyContactsTable";

// tsx cannot load CSS modules; stub them (class name = key) before requiring the component.
require.extensions[".css"] = (cssModule) => {
  cssModule.exports = new Proxy({}, { get: (_, key) => (key === "__esModule" ? false : String(key)) });
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: CompanyContactsTable } = require("./CompanyContactsTable") as typeof import("./CompanyContactsTable");

const company = { companyId: "10000000-0000-4000-8000-000000000001", name: "Fictional Alloys" };
const cycle = { cycleId: "20000000-0000-4000-8000-000000000001", code: "26-27" };
const drive = (driveId: string, overrides: Partial<DriveOption> = {}): DriveOption => ({
  driveId, companyId: company.companyId, companyName: company.name, cycleId: cycle.cycleId, cycleCode: cycle.code, reference: "Round 1",
  hrName: "Test Recruiter", hrEmail: "hr@fictional-alloys.example", hrPhoneNumber: "+91 90000 00001", roles: [], ...overrides,
});
const driveA = drive("3000000a-0000-4000-8000-000000000001");
const render = (overrides: Partial<CompanyContactsTableProps> = {}) =>
  renderToStaticMarkup(<CompanyContactsTable company={company} cycle={cycle} drives={[driveA]} loading={false} error={null} onRetry={() => {}} {...overrides} />);
const count = (html: string, needle: string) => html.split(needle).length - 1;

test("each drive's HR contact is shown once, with tel and mailto links", () => {
  const html = render();
  assert.ok(html.includes("HR contacts") && html.includes("26-27"));
  assert.equal(count(html, "<li"), 1);
  assert.equal(count(html, ">Round 1<"), 1);
  assert.equal(count(html, ">Test Recruiter<"), 1);
  assert.equal(count(html, `<a href="tel:+919000000001">+91 90000 00001</a>`), 1);
  assert.equal(count(html, `<a href="mailto:hr@fictional-alloys.example">hr@fictional-alloys.example</a>`), 1);
  assert.equal(count(html, "Not recorded"), 0);
});

test("several drives get one entry each; unnamed drives are numbered", () => {
  const html = render({ drives: [drive("3000000a-0000-4000-8000-000000000001", { reference: null }), drive("3000000b-0000-4000-8000-000000000002", { reference: null, hrName: "Second Recruiter" })] });
  assert.equal(count(html, "<li"), 2);
  assert.ok(html.includes(">Drive 1<") && html.includes(">Drive 2<") && html.includes(">Second Recruiter<"));
});

test("missing, blank and partial fields show Not recorded without inventing values", () => {
  const partial = render({ drives: [drive(driveA.driveId, { hrName: null, hrPhoneNumber: "   " })] });
  assert.equal(count(partial, "Not recorded"), 2);
  assert.ok(partial.includes("mailto:hr@fictional-alloys.example"));
  assert.ok(!partial.includes("No HR contact is recorded"));

  const empty = render({ drives: [drive(driveA.driveId, { hrName: null, hrPhoneNumber: null, hrEmail: null })] });
  assert.equal(count(empty, "Not recorded"), 3);
  assert.ok(!empty.includes("mailto:") && empty.includes("No HR contact is recorded for this drive."));
});

test("long values are rendered in full without a horizontally scrolling table", () => {
  const hrName = "Recruiter ".repeat(10).trim();
  const email = `${"a".repeat(64)}@${"long-subdomain.".repeat(10)}example`;
  const html = render({ drives: [drive(driveA.driveId, { hrName, hrEmail: email })] });
  assert.ok(html.includes(`>${hrName}<`) && html.includes(`>${email}</a>`));
  assert.ok(!html.includes("<table"));
});

test("drives from another company or cycle are never shown as the current company's", () => {
  const html = render({ drives: [drive(driveA.driveId, { companyId: "10000000-0000-4000-8000-000000000002" }), drive("3000000b-0000-4000-8000-000000000002", { cycleId: "20000000-0000-4000-8000-000000000002" })] });
  assert.ok(html.includes("No drives are recorded for Fictional Alloys in 26-27."));
  assert.ok(!html.includes("Test Recruiter"));
});

test("loading and errors never show previous contacts", () => {
  const loading = render({ loading: true, error: "stale error" });
  assert.ok(loading.includes("Loading HR contacts") && loading.includes(`aria-busy="true"`));
  assert.ok(!loading.includes("Test Recruiter") && !loading.includes("stale error"));

  const failed = render({ error: "Network unavailable" });
  assert.ok(failed.includes(`role="alert"`) && failed.includes("Network unavailable") && failed.includes(">Retry</button>"));
  assert.ok(!failed.includes("Test Recruiter"));
});

test("no company or no cycle shows a prompt, not an empty list", () => {
  const noCompany = render({ company: null });
  assert.ok(noCompany.includes("Select a company") && !noCompany.includes("<li"));
  const allCycles = render({ cycle: null });
  assert.ok(allCycles.includes("Choose a placement cycle") && !allCycles.includes("<li"));
});
