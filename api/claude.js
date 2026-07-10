export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    // Each web search result carries an `encrypted_content` blob, needed only to
    // resume a multi-turn conversation that includes that search. This app makes
    // single-shot requests, so we strip it here — across a few searches with
    // several results each, these blobs can push the response past Vercel's
    // 4.5MB function response limit, which crashes the invocation (500
    // FUNCTION_INVOCATION_FAILED) *before* our catch block below ever runs,
    // since it's enforced by the platform rather than raised as a JS error.
    if (Array.isArray(data.content)) {
      data.content = data.content.map(block => {
        if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
          return {
            ...block,
            content: block.content.map(({ encrypted_content, ...rest }) => rest)
          };
        }
        return block;
      });
    }

    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
