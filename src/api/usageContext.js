// src/api/usageContext.js — who the Claude calls are for (Fix 41). The tracker sets the signed-in
// user once; every call to /api/claude then carries it with the feature's name, so the server can
// keep a record of each call's size and cost per feature and per user.

let user = null;

export const setUsageUser = (uid) => {
  user = uid || null;
};

/** The `_usage` field a request to /api/claude carries. */
export const usageField = (feature) => ({ _usage: { feature, userId: user } });
