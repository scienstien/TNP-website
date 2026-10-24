import assert from "node:assert/strict";
import test from "node:test";
import { applyVolumeMode, companyVolume, compareByVolume } from "./volume";

test("volume is median package times students, and undefined without a recorded package", () => {
  assert.equal(companyVolume(12.5, 4), 50);
  assert.equal(companyVolume(0, 5), 0, "an actual zero package is a real volume of 0");
  assert.equal(companyVolume(null, 5), null);
  assert.equal(companyVolume(10, 0), null);
  assert.equal(companyVolume(Number.NaN, 3), null);
});

test("sorting puts the highest volume first and companies without one last", () => {
  const rows = [
    { name: "Beta", volume: 10 }, { name: "None B", volume: null }, { name: "Alpha", volume: 10 },
    { name: "Top", volume: 90 }, { name: "None A", volume: null }, { name: "Zero", volume: 0 },
  ];
  assert.deepEqual([...rows].sort(compareByVolume).map(row => row.name), ["Top", "Alpha", "Beta", "Zero", "None A", "None B"]);
});

test("volume modes order, reverse and cut the list; missing volumes never rank", () => {
  const rows = [
    { name: "C", volume: 5 }, { name: "None", volume: null }, { name: "A", volume: 50 }, { name: "B", volume: 20 }, { name: "Z", volume: 0 },
  ];
  const names = (mode: Parameters<typeof applyVolumeMode>[1]) => applyVolumeMode(rows, mode).map(row => row.name);
  assert.deepEqual(names("any"), ["C", "None", "A", "B", "Z"]);
  assert.deepEqual(names("high"), ["A", "B", "C", "Z", "None"]);
  assert.deepEqual(names("low"), ["Z", "C", "B", "A", "None"]);
  assert.deepEqual(names("top10"), ["A", "B", "C", "Z"], "no volume, no rank");
  const many = Array.from({ length: 14 }, (_, index) => ({ name: `Co ${index}`, volume: index + 1 }));
  assert.equal(applyVolumeMode(many, "top10").length, 10);
  assert.equal(applyVolumeMode(many, "top10")[0].name, "Co 13");
});
