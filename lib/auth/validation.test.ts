import assert from "node:assert/strict";
import test from "node:test";
import { loginEmail } from "./validation";

test("a bare username belongs to the first allowed domain", () => {
  assert.equal(loginEmail("superadmin"), "superadmin@nitt.edu");
  assert.equal(loginEmail("  Admin123MME "), "admin123mme@nitt.edu");
});

test("a full address is only trimmed and lower-cased", () => {
  assert.equal(loginEmail(" Admin123CSE@NITT.edu "), "admin123cse@nitt.edu");
  assert.equal(loginEmail("someone@example.com"), "someone@example.com");
});

test("empty or non-text input stays empty", () => {
  assert.equal(loginEmail(""), "");
  assert.equal(loginEmail(undefined), "");
  assert.equal(loginEmail(42), "");
});
