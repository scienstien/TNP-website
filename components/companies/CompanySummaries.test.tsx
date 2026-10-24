import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
require.extensions[".css"] = css => { css.exports = new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) }); };
/* eslint-disable @typescript-eslint/no-require-imports */
const { default: CompanyRolePackages } = require("./CompanyRolePackages") as typeof import("./CompanyRolePackages");
const { default: CompanyOfferTypes } = require("./CompanyOfferTypes") as typeof import("./CompanyOfferTypes");
/* eslint-enable @typescript-eslint/no-require-imports */

test("compensation card renders known sample size and the annual package only", () => {
  const html = renderToStaticMarkup(<CompanyRolePackages rows={[{ roleId: null, driveId: null, driveReference: null, jobTitle: null, domain: null, offerCount: 3,
    package: { knownCount: 2, median: 12.5, minimum: 10, maximum: 15 } }]} active loading={false} error={null} onRetry={() => {}} />);
  assert.match(html, /No role recorded/);
  assert.match(html, /12.5/);
  assert.match(html, /2 of 3 known/);
  assert.doesNotMatch(html, /stipend/i);
  const missing = renderToStaticMarkup(<CompanyRolePackages rows={[{ roleId: null, driveId: null, driveReference: null, jobTitle: null, domain: null, offerCount: 1,
    package: { knownCount: 0, median: null, minimum: null, maximum: null } }]} active loading={false} error={null} onRetry={() => {}} />);
  assert.match(missing, /Not recorded/);
  assert.match(missing, /0 of 1 known/);
});

test("offer type card keeps unknown offers visible and refuses inconsistent totals", () => {
  const props = { total: 2, active: true, loading: false, error: null, onRetry: () => {}, roles: [], roleId: null, onRoleChange: () => {} };
  const html = renderToStaticMarkup(<CompanyOfferTypes {...props} types={[{ key: "missing", label: "Not recorded", count: 2 }]} />);
  assert.match(html, /Not recorded/);
  assert.match(html, /100.0/);
  const failed = renderToStaticMarkup(<CompanyOfferTypes {...props} types={[{ key: "PPO", label: "PPO", count: 1 }]} />);
  assert.match(failed, /role="alert"/);
  assert.doesNotMatch(failed, /50.0/);
});

test("compensation role cards show domain and drive reference, numbering identical roles instead of IDs", () => {
  const row = { roleId: "50000001-0000-4000-8000-000000000001", driveId: "30000001-0000-4000-8000-000000000001", driveReference: "Round 1", jobTitle: "SDE", domain: "Software", offerCount: 1,
    package: { knownCount: 1, median: 10, minimum: 10, maximum: 10 } };
  const html = renderToStaticMarkup(<CompanyRolePackages rows={[row, { ...row, roleId: "50000002-0000-4000-8000-000000000002" }]} active loading={false} error={null} onRetry={() => {}} />);
  assert.match(html, /Software · Round 1 \(1\)/);
  assert.match(html, /Software · Round 1 \(2\)/);
  assert.doesNotMatch(html, /50000001/);
});
