// netlify/functions/intel.js
// POST { college, state } → returns { items: [...] }
// Uses Anthropic web_search tool (no beta header needed on direct API).

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

Search the web for REAL, VERIFIED news about ${college}${collegeState ? ' in ' + collegeState : ''} published between ${oneYearAgoStr} and ${todayStr}.

Look for news covering: leadership changes (president/provost/dean), admissions policy changes (test-optional, acceptance rates, Early Decision), tuition or financial aid changes, endowment news, budget cuts or new funding, rankings changes (US News, Forbes, Niche), campus controversies or protests, academic program launches or closures, athletic program changes, major research grants, accreditation issues, campus expansion, notable faculty awards.

RULES:
- Only report things that actually happened with real sources
- If you cannot find enough real news, return fewer items rather than inventing anything
- If you find no real news, return an empty array []

Respond ONLY with a raw JSON array. No markdown, no explanation. Start with [ end with ].

[{"headline":"Concise headline under 12 words","summary":"2-3 sentences: what happened, why it matters, relevance to prospective students.","sentiment":"positive | negative | neutral","category":"Admissions | Leadership | Financials | Rankings | Campus Life | Academics | Athletics | Research | Controversy | Policy","sources":["Publication name"],"confidence":"high | medium | speculative","date":"approximate date e.g. March 2025"}]`;

  let anthropicResponse;
  try {
    anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
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
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Anthropic error ' + anthropicResponse.status, detail: anthropicData })
    };
  }

  // Extract text blocks only — skip web_search tool_use and tool_result blocks
  let text = '';
  if (Array.isArray(anthropicData.content)) {
    for (const block of anthropicData.content) {
      if (block.type === 'text') text += block.text;
    }
  }

  text = text.trim();

  const start = text.indexOf('[');
  const end   = text.lastIndexOf(']');

  if (start === -1 || end === -1) {
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
