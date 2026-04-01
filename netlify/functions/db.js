// netlify/functions/db.js
// GET  /api/db  → returns { colleges, items, lastUpdated }
// POST /api/db  → saves data, returns updated state
//
// Uses Netlify Blobs for shared persistent storage.
// Always returns a valid response — never hangs.

const STORE_KEY = 'college_intel_v1';
const EMPTY = { colleges: [], items: [], lastUpdated: null };

async function getBlobStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore({ name: 'college-intel', consistency: 'strong' });
}

async function readStore() {
  try {
    const store = await getBlobStore();
    const raw = await store.get(STORE_KEY, { type: 'text' });
    if (!raw) return { ...EMPTY };
    return JSON.parse(raw);
  } catch (e) {
    console.error('Blob read error:', e.message);
    return { ...EMPTY };
  }
}

async function writeStore(data) {
  try {
    const store = await getBlobStore();
    await store.set(STORE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Blob write error:', e.message);
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    const data = await readStore();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const current = await readStore();
    const { action, payload } = body;

    if (action === 'save_all') {
      if (payload.colleges  !== undefined) current.colleges  = payload.colleges;
      if (payload.items     !== undefined) current.items     = payload.items;
      current.lastUpdated = payload.lastUpdated || new Date().toISOString();
    } else if (action === 'save_colleges') {
      current.colleges = payload.colleges;
    } else if (action === 'save_items') {
      current.items = payload.items;
      current.lastUpdated = new Date().toISOString();
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action: ' + action }) };
    }

    await writeStore(current);
    return { statusCode: 200, headers, body: JSON.stringify(current) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
