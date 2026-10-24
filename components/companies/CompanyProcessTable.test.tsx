import assert from "node:assert/strict";
import test from "node:test";
import { isValidElement, type ChangeEvent, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PROCESS_LABELS, PROCESS_TYPES } from "@/lib/calendar/labels";
import type { CalendarEvent } from "@/lib/calendar/types";
import type { DriveOption } from "@/lib/drives/types";
import type { CompanyProcessTableProps } from "./CompanyProcessTable";

// tsx cannot load CSS modules; stub them (class name = key) before requiring the component.
require.extensions[".css"] = (cssModule) => {
  cssModule.exports = new Proxy({}, { get: (_, key) => (key === "__esModule" ? false : String(key)) });
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: CompanyProcessTable } = require("./CompanyProcessTable") as typeof import("./CompanyProcessTable");

const company = { companyId: "10000000-0000-4000-8000-000000000001", name: "Fictional Alloys" };
const otherCompany = { companyId: "10000000-0000-4000-8000-000000000002", name: "Fictional Polymers" };
const cycle = { cycleId: "20000000-0000-4000-8000-000000000001", code: "26-27" };
const drive = (driveId: string, reference: string | null, overrides: Partial<DriveOption> = {}): DriveOption =>
  ({ driveId, companyId: company.companyId, companyName: company.name, cycleId: cycle.cycleId, cycleCode: cycle.code, reference, hrName: null, hrEmail: null, hrPhoneNumber: null, roles: [], ...overrides });
const driveA = drive("3000000a-0000-4000-8000-000000000001", "Main campus");
const driveB = drive("3000000b-0000-4000-8000-000000000002", "Main campus");
const driveC = drive("3000000c-0000-4000-8000-000000000003", null);
const event = (eventId: string, overrides: Partial<CalendarEvent> = {}): CalendarEvent =>
  ({ eventId, driveId: driveA.driveId, companyId: company.companyId, companyName: company.name, cycleId: cycle.cycleId, cycleCode: cycle.code, driveReference: driveA.reference, processType: "PPT", scheduledDate: null, scope: "WHOLE_DRIVE", label: null, roles: [], ...overrides });

const props = (overrides: Partial<CompanyProcessTableProps> = {}): CompanyProcessTableProps =>
  ({ company, cycle, drives: [driveA, driveB, driveC], selectedDriveId: driveA.driveId, events: [], loading: false, error: null, onDriveChange: () => {}, onRefresh: () => {}, ...overrides });
const render = (overrides?: Partial<CompanyProcessTableProps>) => renderToStaticMarkup(<CompanyProcessTable {...props(overrides)} />);
const contents = (html: string, tag: string) => [...html.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>(.*?)</${tag}>`, "g"))].map(match => match[1]);
const count = (html: string, needle: string) => html.split(needle).length - 1;

// The component uses no hooks, so its element tree can be expanded without a DOM to reach handlers.
type ElementProps = { children?: ReactNode; [key: string]: unknown };
function elements(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  if (typeof node.type === "function") return elements((node.type as (props: ElementProps) => ReactNode)(node.props));
  return [node, ...elements(node.props.children)];
}

test("exactly two columns, Event type and Scheduled date, with canonical stage labels", () => {
  const events = PROCESS_TYPES.map((processType, index) => event(`4000000${index}-0000-4000-8000-000000000001`, { processType }));
  const html = render({ events });
  assert.ok(html.includes("Drive process"));
  assert.deepEqual(contents(html, "th"), ["Event type", "Scheduled date"]);
  assert.deepEqual(contents(html, "strong"), PROCESS_TYPES.map(type => PROCESS_LABELS[type]));
});

test("repeated and undated events stay separate rows in the supplied order, without date filtering", () => {
  const events = [
    event("40000001-0000-4000-8000-000000000001", { scheduledDate: "2031-03-14" }),
    event("40000002-0000-4000-8000-000000000002", { scheduledDate: "2019-07-01", label: "Round 2" }),
    event("40000003-0000-4000-8000-000000000003", { processType: "OT" }),
  ];
  const html = render({ events });
  assert.equal(count(html, "<tr"), 4, "header plus three event rows");
  assert.equal(count(html, "<strong>PPT</strong>"), 2);
  assert.ok(html.includes("Round 2"));
  assert.equal(count(html, "Not scheduled"), 1);
  assert.ok(html.indexOf("2031-03-14") < html.indexOf("2019-07-01") && html.indexOf("2019-07-01") < html.indexOf("<strong>OT</strong>"));
  assert.ok(html.includes(`<time dateTime="2031-03-14">2031-03-14</time>`));
});

test("scope and selected roles sit inside the event cell, including NULL and repeated titles", () => {
  const roles = [{ roleId: "50000001-0000-4000-8000-000000000001", jobTitle: "Engineer", domain: "Production" }, { roleId: "50000002-0000-4000-8000-000000000002", jobTitle: "Engineer", domain: null }, { roleId: "50000003-0000-4000-8000-000000000003", jobTitle: null, domain: null }];
  const html = render({ events: [event("40000001-0000-4000-8000-000000000001", { scope: "SELECTED_ROLES", roles }), event("40000002-0000-4000-8000-000000000002")] });
  const [selectedCell, wholeCell] = contents(html, "td").filter((_, index) => index % 2 === 0);
  assert.ok(selectedCell.includes("Selected roles"));
  assert.deepEqual(contents(selectedCell, "li"), ["Engineer · Production", "Engineer", "Unknown title"]);
  assert.ok(wholeCell.includes("Whole drive") && !wholeCell.includes("<li"));
  assert.ok(render({ events: [event("40000001-0000-4000-8000-000000000001", { scope: "SELECTED_ROLES" })] }).includes("No roles linked"));
});

test("drive options distinguish repeated and NULL references with plain numbers, never IDs, and no automatic choice", () => {
  const html = render({ selectedDriveId: null });
  assert.deepEqual(contents(html, "option"), ["Choose a drive", "Main campus (1)", "Main campus (2)", "No reference"]);
  assert.ok(html.includes(`<option value="" selected="">Choose a drive</option>`));
  assert.ok(html.includes("Choose a drive to see its process events.") && !html.includes("<table"));

  const twins = [drive("abcdef12-0000-4000-8000-000000000001", "Main"), drive("abcdef12-1000-4000-8000-000000000002", "Main")];
  assert.deepEqual(contents(render({ drives: twins, selectedDriveId: null }), "option").slice(1), ["Main (1)", "Main (2)"]);
});

test("the selected exact drive is shown and only its events are listed", () => {
  const html = render({ selectedDriveId: driveB.driveId, events: [event("40000001-0000-4000-8000-000000000001"), event("40000002-0000-4000-8000-000000000002", { driveId: driveB.driveId, processType: "PI" })] });
  assert.ok(html.includes(`<option value="${driveB.driveId}" selected="">`));
  assert.equal(count(html, "<strong>"), 1);
  assert.ok(html.includes("<strong>PI</strong>") && !html.includes("<strong>PPT</strong>"));
});

test("changed company or cycle hides stale drives and events instead of showing them as current", () => {
  const staleEvents = [event("40000001-0000-4000-8000-000000000001")];
  const otherCompanyView = render({ company: otherCompany, events: staleEvents });
  assert.ok(otherCompanyView.includes("No drives are recorded for Fictional Polymers in 26-27."));
  assert.ok(!otherCompanyView.includes("<select") && !otherCompanyView.includes("<table"));

  const otherCycleDrive = drive("3000000d-0000-4000-8000-000000000004", "Main campus", { cycleId: "20000000-0000-4000-8000-000000000002", cycleCode: "25-26" });
  const unavailable = render({ drives: [otherCycleDrive, driveB], selectedDriveId: otherCycleDrive.driveId, events: staleEvents });
  assert.deepEqual(contents(unavailable, "option"), ["Choose a drive", "Main campus"]);
  assert.ok(unavailable.includes("The selected drive is not available for Fictional Alloys in 26-27."));
  assert.ok(!unavailable.includes("<table"));
});

test("no selection, no drives and no events each have a distinct state", () => {
  assert.ok(render({ company: null }).includes("Select a company and placement cycle to see its drives."));
  assert.ok(render({ cycle: null }).includes("Select a company and placement cycle to see its drives."));
  assert.ok(!render({ company: null }).includes(">Refresh</button>"));
  assert.ok(render({ drives: [] }).includes("No drives are recorded for Fictional Alloys in 26-27."));
  const empty = render({ events: [event("40000001-0000-4000-8000-000000000001", { driveId: driveB.driveId })] });
  assert.ok(empty.includes("No event recorded for this drive. This does not mean a stage did not happen."));
  assert.ok(!empty.includes("<table"));
});

test("loading and errors keep the drive selector but never show stale events", () => {
  const events = [event("40000001-0000-4000-8000-000000000001", { scheduledDate: "2026-08-01" })];
  const loading = render({ loading: true, error: "old error", events });
  assert.ok(loading.includes("Loading drive process") && loading.includes(`aria-busy="true"`) && loading.includes("<select"));
  assert.ok(!loading.includes("2026-08-01") && !loading.includes("old error"));

  const failed = render({ error: "Network unavailable", events });
  assert.ok(failed.includes(`role="alert"`) && failed.includes("Network unavailable") && failed.includes(">Refresh</button>"));
  assert.ok(!failed.includes("2026-08-01"));
  assert.ok(render({ company: null, error: "" }).includes("Process events could not be loaded."));
});

test("drive selection and refresh are delegated to the caller; rendering calls neither", () => {
  const changes: (string | null)[] = [];
  let refreshes = 0;
  const tree = elements(CompanyProcessTable(props({ selectedDriveId: null, onDriveChange: driveId => { changes.push(driveId); }, onRefresh: () => { refreshes += 1; } })));
  assert.deepEqual(changes, []);
  assert.equal(refreshes, 0);

  const select = tree.find(element => element.type === "select");
  assert.ok(select);
  const change = select.props.onChange as (event: ChangeEvent<HTMLSelectElement>) => void;
  change({ target: { value: driveC.driveId } } as unknown as ChangeEvent<HTMLSelectElement>);
  change({ target: { value: "" } } as unknown as ChangeEvent<HTMLSelectElement>);
  assert.deepEqual(changes, [driveC.driveId, null]);

  const refresh = tree.find(element => element.type === "button");
  assert.ok(refresh);
  (refresh.props.onClick as () => void)();
  assert.equal(refreshes, 1);
});
