// netlify/functions/intel.js
// Receives { college, state } POST body, calls Anthropic, returns intel items as JSON array.

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY environment variable is not set' }) };
  }

  let college, collegeState;
  try {
    const body = JSON.parse(event.body || '{}');
    college = body.college;
    collegeState = body.state || '';
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!college) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required field: college' }) };
  }

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const prompt = `You are a college intelligence analyst. Today is ${today}.

Identify 3 significant recent developments at ${college}${collegeState ? ' in ' + collegeState : ''}.

Cover areas such as: leadership changes (president/dean/provost appointments or departures), admissions policy changes (test-optional, acceptance rates, Early Decision), tuition or financial aid changes, endowment news, US News or Forbes rankings changes, campus controversies or protests, academic program launches or closures, athletic program changes, major research grants or discoveries, accreditation issues, campus construction or expansion, notable faculty hires or awards.

CRITICAL FORMATTING RULE: Your entire response must be ONLY a valid JSON array. Do not include any text before or after the array. Do not use markdown code fences. Start your response with [ and end with ].

Required JSON structure for each item:
{
  "headline": "Concise headline, maximum 12 words",
  "summary": "2-3 sentences explaining what happened, why it matters, and its relevance to prospective students or families.",
  "sentiment": "positive | negative | neutral",
  "category": "Admissions | Leadership | Financials | Rankings | Campus Life | Academics | Athletics | Research | Controversy | Policy",
  "sources": ["Publication or source name"],
  "confidence": "high | medium | speculative"
}`;

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Failed to reach Anthropic API: ' + e.message }) };
  }

  let anthropicData;
  try {
    anthropicData = await anthropicResponse.json();
  } catch (e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Anthropic returned non-JSON response' }) };
  }

  if (!anthropicResponse.ok) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Anthropic API error ' + anthropicResponse.status, detail: anthropicData }),
    };
  }

  // Extract text from response
  let text = '';
  if (Array.isArray(anthropicData.content)) {
    for (const block of anthropicData.content) {
      if (block.type === 'text') text += block.text;
    }
  }

  text = text.trim();

  // Find and parse the JSON array
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');

  if (start === -1 || end === -1) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Model did not return a JSON array', raw: text.slice(0, 300) }),
    };
  }

  let items;
  try {
    items = JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'JSON parse failed: ' + e.message, raw: text.slice(0, 300) }),
    };
  }

  if (!Array.isArray(items)) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Parsed value is not an array' }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ items }),
  };
};
