// src/api/claudeClient.js — talking to /api/claude (the serverless proxy): the request, the
// body as JSON (with a readable error when the platform itself failed), the API's own errors,
// and the model's final text — parsed against a schema with Structured Outputs, or as is.

const MODEL = "claude-sonnet-4-6";

// Grabs the model's final text block — needed because when web_search is used,
// content[0] may be a tool-use/tool-result block rather than text.
function extractFinalText(data) {
  const textBlocks = (data.content || []).filter((b) => b.type === "text");
  return textBlocks.length ? textBlocks[textBlocks.length - 1].text : "";
}

// res.json() throws a cryptic "Unexpected token" error if the body isn't JSON —
// which happens when the platform itself fails (timeout, crash) before our
// serverless function code runs, returning an HTML/plain-text error page instead
// of a JSON body. This reads the body as text first so we can say what actually happened.
async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.status === 504 || /timed?\s?out/i.test(text)
        ? "The request timed out — this can happen with web search on a longer lookup. Try a more specific description, or increase maxDuration in vercel.json."
        : `Server returned a non-JSON response (status ${res.status}): ${text.slice(0, 150) || "empty body"}`,
    );
  }
}

// Throws with the real API error message instead of silently returning empty content.
function assertOk(res, data) {
  if (!res.ok || data.error) {
    const msg = data.error?.message || data.error?.type || `API request failed (${res.status})`;
    throw new Error(msg);
  }
}

// Sends a request with output_config.format set, so the API guarantees the
// response text matches the given JSON schema via constrained decoding
// (Structured Outputs) — no reliance on Claude following "return only JSON"
// instructions, no prefill needed, and it still works fine alongside tools
// like web_search since the grammar only constrains Claude's final text output.
export async function requestStructured(body, schema) {
  const data = await post({ ...body, output_config: { format: { type: "json_schema", schema } } });
  if (data.stop_reason === "refusal") {
    throw new Error("Claude declined to generate this — try rephrasing your request.");
  }
  if (data.stop_reason === "max_tokens") {
    throw new Error("Response was cut off before completing — try a shorter/simpler request.");
  }
  return parseReply(extractFinalText(data).trim());
}

/** The final text as JSON; an empty or unparseable reply is an error. */
function parseReply(raw) {
  if (!raw) throw new Error("Claude returned no text content.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Response wasn't valid JSON: ${raw.slice(0, 200)}`);
  }
}

/** The model's final text, unconstrained. */
export async function requestText(body) {
  return extractFinalText(await post(body));
}

/** POST the request (the model filled in) and give back the reply's body, checked. */
async function post(body) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  const data = await safeJson(res);
  assertOk(res, data);
  return data;
}
