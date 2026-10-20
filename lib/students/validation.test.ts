import { test } from "node:test";
import assert from "node:assert/strict";
import { validateStudent } from "./validation";
import { validateCompany } from "./company-validation";

const base = { rollNumber: "123456789", name: "Asha Example", batchYear: "2026" };
test("company creation validates fields without inventing optional values", () => {
  for (const name of ["", " ", "A", "a".repeat(121), 123, null]) {
    assert.ok(validateCompany({ name }).fieldErrors.name);
  }
  assert.ok(validateCompany({ name: "Company", domain: 123 }).fieldErrors.domain);
  assert.ok(validateCompany({ name: "Company", domain: "x".repeat(81) }).fieldErrors.domain);
  assert.ok(validateCompany({ name: "Company", visitDate: "2026-01-01" }).fieldErrors.form);
  assert.deepEqual(validateCompany({ name: "  3M   Example Ltd ", domain: "" }).data,
    { name: "3M Example Ltd", domain: null });
});
test("strict roll parsing and immutable identity", () => {
  for (const rollNumber of ["012345678", "12345678", "1234567890", "1e8", "+123456789", "123456789.0", " 123456789", [], null, 1.2]) {
    assert.ok(validateStudent({ ...base, rollNumber }, true).fieldErrors.rollNumber);
  }
  assert.equal(validateStudent(base, true).data.rollNumber, 123456789);
  assert.ok(validateStudent({ rollNumber: 123456789 }, false).fieldErrors.form);
});
test("required natural names, Unicode and whitespace normalization", () => {
  for (const name of ["", "  ", "Student 123", "<script>", "---", 12, null, "a".repeat(101)]) {
    assert.ok(validateStudent({ ...base, name }, true).fieldErrors.name);
  }
  for (const name of ["Élodie O’Neil", "தமிழ் பெயர்", "Dr. Anne-Marie", "A"]) {
    assert.equal(validateStudent({ ...base, name }, true).fieldErrors.name, undefined);
  }
  assert.equal(validateStudent({ ...base, name: " Asha   Example " }, true).data.name, "Asha Example");
});
test("batch, unknown fields, and malformed data", () => {
  for (const batchYear of ["20", "2e3", 2026.5, null]) assert.ok(validateStudent({ ...base, batchYear }, true).fieldErrors.batchYear);
  assert.ok(validateStudent({ ...base, role: "ADMIN" }, true).fieldErrors.form);
  assert.ok(validateStudent(null, true).fieldErrors.form);
  assert.ok(validateStudent({ offer: { sector: "Overwrite company" } }, false).fieldErrors.form);
});
test("offer nullability, decimals, calendar dates and enum", () => {
  for (const packageLpa of ["-1", "+12", "1e2", "NaN", "Infinity", 12, "1.2.3"]) {
    assert.ok(validateStudent({ offer: { packageLpa } }, false).fieldErrors.packageLpa);
  }
  for (const offerDate of ["2026-02-30", "2025-02-29", "2026-13-01", "not a date"]) {
    assert.ok(validateStudent({ offer: { offerDate } }, false).fieldErrors.offerDate);
  }
  assert.ok(validateStudent({ offer: { offerType: "INTERN" } }, false).fieldErrors.offerType);
  const valid = validateStudent({ offer: { packageLpa: "0.12345", offerDate: "2024-02-29", offerType: null } }, false);
  assert.deepEqual(valid.fieldErrors, {});
  assert.deepEqual(valid.data.offer, { packageLpa: "0.12345", offerDate: "2024-02-29", offerType: null });
  assert.deepEqual(validateStudent({ offer: { packageLpa: "" } }, false).data.offer, { packageLpa: null });
  assert.deepEqual(validateStudent({ name: "Updated Name" }, false).data, { name: "Updated Name" });
});
