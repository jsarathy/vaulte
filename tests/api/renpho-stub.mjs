// tests/api/renpho-stub.mjs — a stand-in for Renpho's cloud for the /api/renpho-sync tests:
// requests are decrypted from the app's AES-128-ECB envelope and recorded, replies encrypted the
// way the app receives them. Also the call helper, a clock moved past the 50-minute token cache
// before every test, and captured console errors.
import { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { res } from "./setup.mjs";
import handler from "../../api/renpho-sync.js";

const KEY = Buffer.from("ed*wijdi$h6fe3ew", "utf8");
export const enc = (obj) => {
  const c = crypto.createCipheriv("aes-128-ecb", KEY, null);
  return Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]).toString("base64");
};
const dec = (b64) => {
  const d = crypto.createDecipheriv("aes-128-ecb", KEY, null);
  return JSON.parse(Buffer.concat([d.update(Buffer.from(b64, "base64")), d.final()]).toString());
};

export const LOGIN = "renpho-aggregation/user/login";
export const DEVICES = "renpho-aggregation/device/count";
export const BASIC = "RenphoHealth/scale/queryAllMeasureDataList";
export const BODY = "RenphoHealth/scale/queryBodyCompositionMeasureData";
export const GIRTH = "RenphoHealth/renpho/girth/queryAllGirthsDataList";

const BASE = "https://cloud.renpho.com/";
const realFetch = globalThis.fetch;
const realNow = Date.now;
const realError = console.error;
export const clock = { now: 1_800_000_000_000 };
export const calls = []; // { endpoint, method, headers, body (decrypted) }
export const cloud = {}; // endpoint → (decrypted request) => { status?, body }
export const errors = [];

/** Serve the given routes (replacing any earlier ones) and record every request. */
export function stubCloud(routes) {
  calls.length = 0;
  for (const k of Object.keys(cloud)) delete cloud[k];
  Object.assign(cloud, routes);
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    assert.ok(u.startsWith(BASE), `unexpected fetch ${u}`);
    const endpoint = u.slice(BASE.length);
    const body = dec(JSON.parse(opts.body).encryptData);
    calls.push({ endpoint, method: opts.method, headers: opts.headers, body });
    assert.ok(cloud[endpoint], `no stub for ${endpoint}`);
    const { status = 200, body: reply } = cloud[endpoint](body);
    return { ok: status >= 200 && status < 300, status, json: async () => reply };
  };
}

export const ok = (data, code = 101) => ({ body: { code, msg: "ok", data: enc(data) } });
export const login =
  (token = "tok-1", id = 77) =>
  () =>
    ok({ login: { token, id } });
export const devices = (scale) => () => ok({ scale });
/** Paged replies: list n for page n, then empty pages. */
export const pages =
  (...lists) =>
  (req) =>
    ok(lists[req.pageNum - 1] ?? []);
export const sec = (iso) => Date.parse(iso) / 1000;

export async function call(body, method = "POST") {
  const out = res();
  await handler({ method, body }, out);
  return out;
}

beforeEach(() => {
  clock.now += 3_600_000; // past the 50-minute token cache: every test logs in afresh
  Date.now = () => clock.now;
  process.env.RENPHO_EMAIL = "me@example.com";
  process.env.RENPHO_PASSWORD = "pw";
  errors.length = 0;
  console.error = (...a) => errors.push(a.map(String).join(" "));
});
afterEach(() => {
  globalThis.fetch = realFetch;
  Date.now = realNow;
  console.error = realError;
});
