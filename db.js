// netlify/functions/db.js
// GET  /api/db          → returns { colleges, items, lastUpdated }
// POST /api/db          → body: { action, payload } → saves data, returns updated state
//
// Storage: Netlify Blobs (key/value, persists across deploys and function instances).
// Falls back to an in-memory object if Blobs are not available (local dev).
//
// Supported actions:
//   save_colleges   payload: { colleges }
//   save_items      payload: { items }
//   save_all        payload: { colleges, items, lastUpdated }

const STORE_KEY = 'college_intel_v1';

// Attempt to load @netlify/blobs. It's pre-installed in Netlify's function runtime.
let blobsAvailable = false;
let getStore;
try {
  ({ getStore } = require('@netlify/blobs'));
  blobsAvailable = true;
} catch (e) {
  // Running locally without the package — fall back to in-memory
  blobsAvailable = false;
}

// In-memory fallback (lost on cold start, fine for local dev)
let memoryStore = { colleges: [], items: [], lastUpdated: null };

async function readStore() {
  if (!blobsAvailable) return { ...memoryStore };
  try {
    const store = getStore('college-intel');
    const raw = await store.get(STORE_KEY);
    if (!raw) return { colleges: [], items: [], lastUpdated: null };
    return JSON.parse(raw);
  } catch (e) {
    console.error('Blob read error:', e.message);
    return { colleges: [], items: [], lastUpdated: null };
  }
}

async function writeStore(data) {
  if (!blobsAvailable) {
    memoryStore = data;
    return;
  }
  try {
    const store = getStore('college-intel');
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

  // GET — return current state
  if (event.httpMethod === 'GET') {
    const data = await readStore();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  // POST — update state
  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const current = await readStore();
    const { action, payload } = body;

    if (action === 'save_colleges') {
      current.colleges = payload.colleges;
    } else if (action === 'save_items') {
      current.items = payload.items;
      current.lastUpdated = new Date().toISOString();
    } else if (action === 'save_all') {
      if (payload.colleges !== undefined) current.colleges = payload.colleges;
      if (payload.items !== undefined) current.items = payload.items;
      current.lastUpdated = payload.lastUpdated || new Date().toISOString();
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action: ' + action }) };
    }

    await writeStore(current);
    return { statusCode: 200, headers, body: JSON.stringify(current) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
