import assert from "node:assert/strict";
import test from "node:test";
import { validateCompanyCreate, validateCompanyUpdate } from "./validation";

test("company creation normalizes name, leaves optional details empty and defaults PVR to No", () => {
  const result = validateCompanyCreate({ name: "  Example   Metals  " });
  assert.deepEqual(result.fieldErrors, {});
  assert.deepEqual(result.data, {
    name: "Example Metals", domain: null, hrName: null, email: null,
    phoneNumber: null, remarks: null, pvrStatus: false,
  });
});

test("company creation rejects missing names, malformed payloads and unrelated fields", () => {
  for (const input of [null, [], "Company", {}, { name: " " }, { name: 42 }, { name: "A" }, { name: "a".repeat(121) }]) {
    assert.ok(validateCompanyCreate(input).fieldErrors.name);
  }
  for (const key of ["batchYear", "offer", "role"]) {
    assert.ok(validateCompanyCreate({ name: "Example Metals", [key]: "unexpected" }).fieldErrors.form);
  }
});

test("company creation uses existing contact and PVR validation", () => {
  const result = validateCompanyCreate({ name: "Example Metals", email: "bad", phoneNumber: "bad", pvrStatus: "maybe", remarks: "x".repeat(1001) });
  for (const key of ["email", "phoneNumber", "pvrStatus", "remarks"]) assert.ok(result.fieldErrors[key]);
  const valid = validateCompanyCreate({ name: "Example Metals", email: " HR@EXAMPLE.COM ", pvrStatus: "unknown" });
  assert.deepEqual(valid.fieldErrors, {});
  assert.equal(valid.data.email, "hr@example.com");
  assert.equal(valid.data.pvrStatus, null);
});

test("existing company update still rejects renaming and preserves unknown PVR", () => {
  assert.ok(validateCompanyUpdate({ name: "New name" }, "Example Metals").fieldErrors.form);
  assert.equal(validateCompanyUpdate({ pvrStatus: "unknown" }, "Example Metals").data.pvrStatus, null);
});

test("visitDate keys on create and update are rejected, including clear attempts", () => {
  for (const visitDate of [undefined, null, "", "2026-10-22"]) {
    assert.match(validateCompanyCreate({ name: "Example Metals", visitDate }).fieldErrors.form!, /PPT events/);
    assert.match(validateCompanyUpdate({ visitDate }, "Example Metals").fieldErrors.form!, /PPT events/);
  }
});

test("contact-only normalization emits only company fields and preserves unknown PVR", () => {
  const result = validateCompanyUpdate({ hrName: "  Fictional   Contact ", email: " HR@EXAMPLE.COM ", pvrStatus: "unknown" }, "Example Metals");
  assert.deepEqual(result.fieldErrors, {});
  assert.equal(result.data.hrName, "Fictional Contact");
  assert.equal(result.data.email, "hr@example.com");
  assert.equal(result.data.pvrStatus, null);
  assert.deepEqual(Object.keys(result.data).sort(), ["domain", "email", "hrName", "phoneNumber", "pvrStatus", "remarks"]);
});
