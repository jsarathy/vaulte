// api/renpho-sync.js
// Pulls weight measurements from the Renpho Health cloud (cloud.renpho.com).
//
// There is no official Renpho API. The endpoints, the AES-128-ECB envelope and
// the payload shapes below come from reverse-engineered clients and can break
// without notice. Credentials stay server-side: never call this from the client
// with the email/password in the body.
//
// Required Vercel env vars:
//   RENPHO_EMAIL
//   RENPHO_PASSWORD

import crypto from "crypto";

const API_BASE = "https://cloud.renpho.com";
const ENC_KEY = "ed*wijdi$h6fe3ew"; // 16-byte AES-128 key used by the app
const APP_VERSION = "6.6.0";
const PLATFORM = "android";
const SUCCESS_CODES = new Set([0, "0", 101, "101", 200, "200", 20000, "20000"]);

// Device type codes for body-weight scales (ES-20M is in this family).
const BODY_WEIGHT_SCALES = [
  "01","02","03","04","05","06","07","08","09","0A",
  "0B","0C","0D","0E","0F","10","11","12","13","14",
];

const ENDPOINTS = {
  login: "renpho-aggregation/user/login",
  deviceInfo: "renpho-aggregation/device/count",
  measurements: "RenphoHealth/scale/queryAllMeasureDataList",
  bodyComposition: "RenphoHealth/scale/queryBodyCompositionMeasureData",
};

// ── AES-128-ECB envelope ─────────────────────────────────────────────────────
function aesEncrypt(plaintext) {
  const c = crypto.createCipheriv("aes-128-ecb", Buffer.from(ENC_KEY, "utf8"), null);
  c.setAutoPadding(true); // PKCS7
  return Buffer.concat([c.update(plaintext, "utf8"), c.final()]).toString("base64");
}
function aesDecrypt(b64) {
  const d = crypto.createDecipheriv("aes-128-ecb", Buffer.from(ENC_KEY, "utf8"), null);
  d.setAutoPadding(true);
  return Buffer.concat([d.update(Buffer.from(b64, "base64")), d.final()]).toString("utf8");
}
const encryptRequest = (obj) => ({ encryptData: aesEncrypt(JSON.stringify(obj)) });
const decryptResponse = (data) => JSON.parse(aesDecrypt(data));

// ── Token cache (survives warm lambda invocations) ───────────────────────────
let cached = { token: null, userId: null, at: 0 };
const TOKEN_TTL_MS = 50 * 60 * 1000;

function checkResponse(result, context) {
  const code = result?.code;
  const msg = String(result?.msg ?? "");
  if (msg.toLowerCase() === "success" || SUCCESS_CODES.has(code)) return;
  throw new Error(`${context} failed: code=${code}, msg=${msg}`);
}

async function post(endpoint, body, { token, userId } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.token = token;
    headers.userId = String(userId);
    headers.appVersion = APP_VERSION;
    headers.platform = PLATFORM;
  }
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${endpoint} HTTP ${res.status}`);
  return res.json();
}

async function login(email, password) {
  if (cached.token && Date.now() - cached.at < TOKEN_TTL_MS) return cached;
  const payload = {
    questionnaire: {},
    login: {
      password, areaCode: "US", appRevision: APP_VERSION,
      cellphoneType: "VaulteSync", systemType: "11", email, platform: PLATFORM,
    },
    bindingList: { deviceTypes: BODY_WEIGHT_SCALES },
  };
  const result = await post(ENDPOINTS.login, encryptRequest(payload));
  checkResponse(result, "Login");
  const data = decryptResponse(result.data);
  const info = data?.login || {};
  if (!info.token) throw new Error("Login returned no token");
  cached = { token: info.token, userId: info.id, at: Date.now() };
  return cached;
}

function extractRecords(pageData) {
  if (Array.isArray(pageData)) return pageData.length ? pageData : null;
  if (pageData && typeof pageData === "object") {
    for (const k of ["list", "data", "records", "measurements"]) {
      if (Array.isArray(pageData[k])) return pageData[k].length ? pageData[k] : null;
    }
    if ("weight" in pageData) return [pageData];
  }
  return null;
}

async function fetchPaged(endpoint, tableName, uid, auth, pageSize = 50) {
  const out = [];
  for (let page = 1; page <= 40; page++) {
    const result = await post(
      endpoint,
      encryptRequest({ pageNum: page, pageSize, userIds: [String(uid)], tableName }),
      auth
    );
    checkResponse(result, `${endpoint} page ${page}`);
    if (!result.data) break;
    const recs = extractRecords(decryptResponse(result.data));
    if (!recs) break;
    out.push(...recs);
    if (recs.length < pageSize) break;
  }
  return out;
}

// Renpho timestamps are epoch seconds on some records, ms on others.
function toISODate(ts) {
  if (ts == null) return null;
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n < 1e12 ? n * 1000 : n;
  const d = new Date(ms);
  return isNaN(d) ? null : d.toISOString().split("T")[0];
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const email = process.env.RENPHO_EMAIL;
  const password = process.env.RENPHO_PASSWORD;
  if (!email || !password) {
    return res.status(500).json({ error: "RENPHO_EMAIL / RENPHO_PASSWORD not configured" });
  }

  try {
    const auth = await login(email, password);

    const devResult = await post(ENDPOINTS.deviceInfo, encryptRequest({}), auth);
    checkResponse(devResult, "DeviceInfo");
    const devInfo = devResult.data ? decryptResponse(devResult.data) : {};
    const scales = Array.isArray(devInfo.scale) ? devInfo.scale : [];

    if (!scales.length) {
      return res.status(200).json({
        records: [], count: 0,
        warning: "No scale found on the account. Open the Renpho Health app and let it sync.",
      });
    }

    const raw = [];
    for (const scale of scales) {
      const tableName = scale?.tableName;
      if (!tableName) continue;
      const uids = Array.isArray(scale.userIds) ? scale.userIds : [];
      const uid = uids.length && !uids.includes(auth.userId) ? uids[0] : auth.userId;

      // Body-composition endpoint first; weight-only scales answer on the basic one.
      let recs = await fetchPaged(ENDPOINTS.bodyComposition, tableName, uid, auth);
      if (!recs.length) recs = await fetchPaged(ENDPOINTS.measurements, tableName, uid, auth);
      raw.push(...recs);
    }

    // Weight only, for now. One record per calendar day: latest reading wins.
    const byDate = new Map();
    for (const m of raw) {
      const date = toISODate(m.timeStamp ?? m.timestamp ?? m.created_at);
      const weight = Number(m.weight);
      if (!date || !Number.isFinite(weight) || weight <= 0) continue;
      const ts = Number(m.timeStamp ?? m.timestamp ?? 0);
      const prev = byDate.get(date);
      if (!prev || ts >= prev.ts) byDate.set(date, { date, weight: +weight.toFixed(2), ts });
    }

    const records = [...byDate.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ date, weight }) => ({ date, weight }));

    return res.status(200).json({ records, count: records.length, rawCount: raw.length });
  } catch (err) {
    console.error("renpho-sync error:", err);
    return res.status(502).json({ error: err.message || "Renpho sync failed" });
  }
}
