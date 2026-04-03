// netlify/functions/analyze.mjs
// Streams Anthropic API responses through to the browser.
// Streaming keeps the connection alive and prevents Netlify's inactivity timeout.
// Set ANTHROPIC_API_KEY in Netlify environment variables.

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: { type: "method_not_allowed", message: "POST only." } }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: {
          type: "configuration_error",
          message: "ANTHROPIC_API_KEY is not set. Add it in Netlify Site settings > Environment variables.",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let requestBody;
  try {
    requestBody = await req.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: { type: "invalid_request", message: "Invalid JSON body." } }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Force streaming on
  requestBody.stream = true;

  try {
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    if (!apiResponse.ok && !apiResponse.body) {
      const errText = await apiResponse.text();
      return new Response(errText, {
        status: apiResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Pipe the SSE stream straight through to the browser
    return new Response(apiResponse.body, {
      status: apiResponse.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: {
          type: "proxy_error",
          message: "Failed to reach Anthropic API: " + (err.message || "Unknown error"),
        },
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/.netlify/functions/analyze",
};
