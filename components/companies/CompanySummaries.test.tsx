import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
require.extensions[".css"] = css => { css.exports = new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) }); };
/* eslint-disable @typescript-eslint/no-require-imports */
const { default: CompanyRolePackages } = require("./CompanyRolePackages") as typeof import("./CompanyRolePackages");
const { default: CompanyOfferTypes } = require("./CompanyOfferTypes") as typeof import("./CompanyOfferTypes");
/* eslint-enable @typescript-eslint/no-require-imports */

test("compensation card renders known sample size and separate package/stipend units", () => {
  const html = renderToStaticMarkup(<CompanyRolePackages rows={[{ roleId: null, driveId: null, driveReference: null, jobTitle: null, offerCount: 3,
    package: { knownCount: 2, median: 12.5, minimum: 10, maximum: 15 }, stipend: { knownCount: 0, median: null, minimum: null, maximum: null } }]} active loading={false} error={null} onRetry={() => {}} />);
  assert.match(html, /No role recorded/);
  assert.match(html, /12.5/);
  assert.match(html, /2 of 3 known/);
  assert.match(html, /Monthly stipend/);
  assert.match(html, /Not recorded/);
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
