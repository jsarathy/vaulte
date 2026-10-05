// api/_renpho/client.js — talking to the Renpho Health cloud (cloud.renpho.com) for
// /api/renpho-sync: the app's AES-128-ECB envelope, login (token kept for 50 minutes across warm
// invocations), signed POSTs, Renpho's success codes, and paged list requests.
//
// There is no official Renpho API. The endpoints, the envelope and the payload shapes come from
// reverse-engineered clients and can break without notice. (Files under api/_… aren't deployed
// as functions.)
import crypto from "crypto";

const API_BASE = "https://cloud.renpho.com";
const ENC_KEY = Buffer.from("ed*wijdi$h6fe3ew", "utf8"); // 16-byte AES-128 key used by the app
const APP_VERSION = "6.6.0";
const PLATFORM = "android";
const SUCCESS_CODES = new Set([0, "0", 101, "101", 200, "200", 20000, "20000"]);
const TOKEN_TTL_MS = 50 * 60 * 1000;
const MAX_PAGES = 40;

// Device type codes for body-weight scales (ES-20M is in this family): "01" … "14" in hex.
const BODY_WEIGHT_SCALES = Array.from({ length: 20 }, (_, i) =>
  (i + 1).toString(16).toUpperCase().padStart(2, "0"),
);

export const ENDPOINTS = {
  login: "renpho-aggregation/user/login",
  deviceInfo: "renpho-aggregation/device/count",
  measurements: "RenphoHealth/scale/queryAllMeasureDataList",
  bodyComposition: "RenphoHealth/scale/queryBodyCompositionMeasureData",
  girth: "RenphoHealth/renpho/girth/queryAllGirthsDataList",
};

// ── AES-128-ECB envelope (PKCS7 padding) ──
function aesEncrypt(plaintext) {
  const c = crypto.createCipheriv("aes-128-ecb", ENC_KEY, null);
  c.setAutoPadding(true);
  return Buffer.concat([c.update(plaintext, "utf8"), c.final()]).toString("base64");
}
function aesDecrypt(b64) {
  const d = crypto.createDecipheriv("aes-128-ecb", ENC_KEY, null);
  d.setAutoPadding(true);
  return Buffer.concat([d.update(Buffer.from(b64, "base64")), d.final()]).toString("utf8");
}
export const encryptRequest = (obj) => ({ encryptData: aesEncrypt(JSON.stringify(obj)) });
export const decryptResponse = (data) => JSON.parse(aesDecrypt(data));

/** Throws unless Renpho reports success (by message or one of its success codes). */
export function checkResponse(result, context) {
  const code = result?.code;
  const msg = String(result?.msg ?? "");
  if (msg.toLowerCase() === "success" || SUCCESS_CODES.has(code)) return;
  throw new Error(`${context} failed: code=${code}, msg=${msg}`);
}

const authHeaders = ({ token, userId }) => ({
  token,
  userId: String(userId),
  appVersion: APP_VERSION,
  platform: PLATFORM,
});

/** POST a JSON body; signed with the login token when auth is given. */
export async function post(endpoint, body, auth = {}) {
  const headers = { "Content-Type": "application/json", ...(auth.token && authHeaders(auth)) };
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${endpoint} HTTP ${res.status}`);
  return res.json();
}

const loginPayload = (email, password) => ({
  questionnaire: {},
  login: {
    password,
    areaCode: "US",
    appRevision: APP_VERSION,
    cellphoneType: "VaulteSync",
    systemType: "11",
    email,
    platform: PLATFORM,
  },
  bindingList: { deviceTypes: BODY_WEIGHT_SCALES },
});

// Token cache (survives warm lambda invocations)
let cached = { token: null, userId: null, at: 0 };

/** { token, userId }: the cached login while fresh, else a new one. */
export async function login(email, password) {
  if (cached.token && Date.now() - cached.at < TOKEN_TTL_MS) return cached;
  const result = await post(ENDPOINTS.login, encryptRequest(loginPayload(email, password)));
  checkResponse(result, "Login");
  const info = decryptResponse(result.data)?.login || {};
  if (!info.token) throw new Error("Login returned no token");
  cached = { token: info.token, userId: info.id, at: Date.now() };
  return cached;
}

const LIST_KEYS = ["list", "data", "records", "measurements"];

/** A page's records: a list, a list under a known key, or one record; [] when none. */
function pageRecords(pageData) {
  if (Array.isArray(pageData)) return pageData;
  const list = LIST_KEYS.map((k) => pageData?.[k]).find(Array.isArray);
  if (list) return list;
  return pageData && typeof pageData === "object" && "weight" in pageData ? [pageData] : [];
}

/**
 * Every record of a paged list (at most 40 pages). page: { endpoint, body, auth, pageSize,
 * label } — body is merged into each page's request; label names the request in errors.
 */
export async function fetchPages(page) {
  const out = [];
  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const request = { pageNum, pageSize: page.pageSize, ...page.body };
    const result = await post(page.endpoint, encryptRequest(request), page.auth);
    checkResponse(result, `${page.label} page ${pageNum}`);
    const recs = result.data ? pageRecords(decryptResponse(result.data)) : [];
    out.push(...recs);
    if (recs.length < page.pageSize) break;
  }
  return out;
}
