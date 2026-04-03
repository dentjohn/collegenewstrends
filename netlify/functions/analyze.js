// netlify/functions/analyze.js
// Proxies requests to the Anthropic API using a server-side API key.
// Set ANTHROPIC_API_KEY in Netlify environment variables (Site settings > Environment variables).

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: { type: "method_not_allowed", message: "Only POST requests are accepted." } }),
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: {
          type: "configuration_error",
          message: "ANTHROPIC_API_KEY is not set. Add it in Netlify Site settings > Environment variables.",
        },
      }),
    };
  }

  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: { type: "invalid_request", message: "Request body is not valid JSON." } }),
    };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: data,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: {
          type: "proxy_error",
          message: "Failed to reach Anthropic API: " + (err.message || "Unknown error"),
        },
      }),
    };
  }
};
