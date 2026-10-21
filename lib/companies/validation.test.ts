import assert from "node:assert/strict";
import test from "node:test";
import { validateCompanyCreate, validateCompanyUpdate } from "./validation";

test("company creation normalizes name, leaves optional details empty and defaults PVR to No", () => {
  const result = validateCompanyCreate({ name: "  Example   Metals  " });
  assert.deepEqual(result.fieldErrors, {});
  assert.deepEqual(result.data, {
    name: "Example Metals", domain: null, hrName: null, email: null,
    phoneNumber: null, remarks: null, pvrStatus: false, visitDate: null,
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

test("company creation uses existing contact, PVR and date validation", () => {
  const result = validateCompanyCreate({ name: "Example Metals", email: "bad", phoneNumber: "bad", visitDate: "2026-02-30", pvrStatus: "maybe", remarks: "x".repeat(1001) });
  for (const key of ["email", "phoneNumber", "visitDate", "pvrStatus", "remarks"]) assert.ok(result.fieldErrors[key]);
  const valid = validateCompanyCreate({ name: "Example Metals", email: " HR@EXAMPLE.COM ", pvrStatus: "unknown", visitDate: "2024-02-29" });
  assert.deepEqual(valid.fieldErrors, {});
  assert.equal(valid.data.email, "hr@example.com");
  assert.equal(valid.data.pvrStatus, null);
  assert.equal(valid.data.visitDate, "2024-02-29");
});

test("existing company update still rejects renaming and preserves unknown PVR", () => {
  assert.ok(validateCompanyUpdate({ name: "New name" }, "Example Metals").fieldErrors.form);
  assert.equal(validateCompanyUpdate({ pvrStatus: "unknown" }, "Example Metals").data.pvrStatus, null);
});
