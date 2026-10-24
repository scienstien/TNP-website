import assert from "node:assert/strict";
import test from "node:test";
import { placementRate } from "./breakdown-types";

test("placement rate is placed over registered", () => {
  assert.equal(placementRate(3, 4), 75);
  assert.equal(placementRate(0, 4), 0);
});

test("an empty registered group has an undefined rate, not 0%", () => {
  assert.equal(placementRate(0, 0), null);
});
