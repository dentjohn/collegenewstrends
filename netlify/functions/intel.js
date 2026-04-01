// netlify/functions/intel.js
// POST { college, state } → returns { items: [...] }
// Uses Anthropic web_search tool to find real news from the last 365 days.

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }) };

  let college, collegeState;
  try {
    const body = JSON.parse(event.body || '{}');
    college = body.college;
    collegeState = body.state || '';
  } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!college) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing field: college' }) };

  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  const todayStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const oneYearAgoStr = oneYearAgo.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const prompt = `You are a college intelligence analyst. Today is ${todayStr}.

Use web search to find REAL, VERIFIED news about ${college}${collegeState ? ' in ' + collegeState : ''} published between ${oneYearAgoStr} and ${todayStr} (the last 365 days).

Search for recent news covering: leadership changes (president/provost/dean appointments or departures), admissions policy changes (test-optional, acceptance rates, Early Decision), tuition or financial aid changes, endowment news, budget cuts or new funding, US News or Forbes rankings changes, campus controversies or protests, academic program launches or closures, athletic program changes, major research grants, accreditation issues, campus expansion, notable faculty awards.

IMPORTANT RULES:
- Only report things that actually happened — do not fabricate or speculate
- Each item must be from a real, verifiable source published in the last 365 days
- If you cannot find enough real news, return fewer items (even just 1) rather than making things up
- If you find no real news at all, return an empty array []

Respond ONLY with a raw JSON array. No markdown, no explanation, no preamble. Start with [ and end with ].

[{"headline":"Concise headline under 12 words","summary":"2-3 sentences: what happened, why it matters, relevance to prospective students.","sentiment":"positive | negative | neutral","category":"Admissions | Leadership | Financials | Rankings | Campus Life | Academics | Athletics | Research | Controversy | Policy","sources":["Publication name"],"confidence":"high | medium | speculative","date":"approximate date if known, e.g. March 2025"}]`;

  let anthropicResponse;
  try {
    anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch(e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Failed to reach Anthropic: ' + e.message }) };
  }

  let anthropicData;
  try {
    anthropicData = await anthropicResponse.json();
  } catch(e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Anthropic returned non-JSON' }) };
  }

  if (!anthropicResponse.ok) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Anthropic error ' + anthropicResponse.status, detail: anthropicData }) };
  }

  // Extract text blocks from response (may include web_search tool use blocks — skip those)
  let text = '';
  if (Array.isArray(anthropicData.content)) {
    for (const block of anthropicData.content) {
      if (block.type === 'text') text += block.text;
    }
  }

  text = text.trim();

  // Find JSON array boundaries
  const start = text.indexOf('[');
  const end   = text.lastIndexOf(']');

  if (start === -1 || end === -1) {
    // Model found no news — return empty rather than error
    return { statusCode: 200, headers, body: JSON.stringify({ items: [] }) };
  }

  let items;
  try {
    items = JSON.parse(text.slice(start, end + 1));
  } catch(e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'JSON parse failed: ' + e.message }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ items: Array.isArray(items) ? items : [] }),
  };
};
