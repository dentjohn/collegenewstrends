// netlify/functions/analyze.js
// Proxies requests to the Anthropic API using a server-side API key.
// The key is stored as a Netlify environment variable (ANTHROPIC_API_KEY).

const SYSTEM_PROMPT = `You are a higher-education intelligence analyst. Search the web for recent news (last 12 months) about universities to identify institutional signals.

Respond ONLY with a valid JSON object. No markdown fences, no preamble, no explanation outside the JSON.

JSON schema:
{"school":"string","overall_signal":"positive|negative|mixed|unclear","signal_strength":"high|medium|low","confidence":"high|medium|low","summary":"2-3 sentence executive summary","categories":{"<category_id>":{"signal":"positive|negative|mixed|unclear|none","findings":["bullet 1","bullet 2"]}},"follow_up_searches":["search query 1","search query 2"],"why_it_matters":"1 paragraph"}

Category IDs: lost_research_grants, major_new_grants, enrollment_increase, enrollment_decline, senior_admin_turnover, scandals, budget_cuts, accreditation_regulatory, labor_unrest, program_closures

Rules:
- Use web search to find REAL, CURRENT news from the last 12 months.
- Be specific: cite dollar amounts, names, dates when available.
- If no evidence for a category, set signal to "none" and findings to ["No significant developments found in the last 12 months"].
- Be analytical and skeptical. Distinguish noise from signal.
- Do NOT invent findings. Only report what you find via web search.
- Return ONLY the JSON object, nothing else.`;

export default async (req) => {
  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const school = body.school;

    if (!school || typeof school !== "string" || school.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid school name" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: `Search for the most important recent news (last 12 months) about "${school}" across all 10 institutional signal categories. Be thorough and specific with dates, dollar amounts, and names.`,
          },
        ],
      }),
    });

    const data = await resp.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract text blocks from response
    const textBlocks = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text);
    const rawText = textBlocks.join("\n");

    return new Response(JSON.stringify({ raw: rawText }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
