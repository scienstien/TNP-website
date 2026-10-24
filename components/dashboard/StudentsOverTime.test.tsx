import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import StudentsOverTime from "./StudentsOverTime";
import type { PlacementRecord } from "@/lib/placements/types";

const record: PlacementRecord = {
  department: "civil", cycleId: "c", cycleCode: "26-27", cycleStartsOn: null, cycleEndsOn: null, registrationStatus: "REGISTERED",
  offer: { company: "Acme", domain: null, packageLpa: 10, offerType: "FTE", offerDate: "2026-09-01" },
};
const render = (departmentName: string | null = "Civil Engineering") =>
  renderToStaticMarkup(<StudentsOverTime records={[record]} today="2026-10-24" departmentName={departmentName} />);

test("the toggle is a radio group of Year, Month, Week and Day with Year selected and a single tab stop", () => {
  const html = render();
  assert.match(html, /role="radiogroup"[^>]*aria-label="Group students by"/);
  const radios = [...html.matchAll(/<button[^>]*role="radio"[^>]*>(Year|Month|Week|Day)<\/button>/g)];
  assert.deepEqual(radios.map(match => match[1]), ["Year", "Month", "Week", "Day"]);
  assert.equal(radios.filter(match => match[0].includes('tabindex="0"')).length, 1, "roving tab index: one tab stop");
  assert.match(radios[0][0], /aria-checked="true"/);
  assert.match(radios[0][0], /tabindex="0"/);
  assert.match(radios[1][0], /aria-checked="false"/);
  assert.match(radios[1][0], /tabindex="-1"/);
});

test("the section names its scope and shows a loading skeleton until the chart can measure itself", () => {
  const html = render();
  assert.match(html, /Students placed over time/);
  assert.match(html, /Final offers by offer date · Civil Engineering/);
  assert.match(html, /aria-busy="true"/);
  assert.match(render(null), /all departments/);
});
