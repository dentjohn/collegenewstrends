# College Intelligence Hub

A daily intelligence feed for college counselors — tracks major developments at US colleges and surfaces them in a clean dashboard with bookmarks, client flagging, and email digests.

---

## Setup (one time, ~10 minutes)

### 1. Push to GitHub

Create a new GitHub repository and push this folder:

```bash
cd college-intel
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/college-intel.git
git push -u origin main
```

### 2. Deploy to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**
2. Connect GitHub and select your `college-intel` repo
3. Build settings are auto-detected from `netlify.toml` — no changes needed
4. Click **Deploy site**

### 3. Add your Anthropic API key

1. In Netlify: **Site configuration → Environment variables → Add a variable**
2. Key: `ANTHROPIC_API_KEY`
3. Value: your Anthropic API key (starts with `sk-ant-...`)
4. Click **Save** and trigger a redeploy (Deploys → Trigger deploy)

### 4. Enable Netlify Blobs (shared database)

Netlify Blobs is enabled automatically on any deployed site — no extra steps needed.
All teammates who visit the URL will share the same college list, intel items, bookmarks, and flags.

---

## Usage

- **Refresh All** — runs once per day; calls Anthropic for each tracked college and stores results
- **+ College** — add any US college to the watchlist
- **🔖 Bookmark** — save items for your own reference
- **🚩 Flag for Client** — tag items with a client family name and counselor note
- **Email Digest** — generate a formatted digest (full feed, flagged only, bookmarks, or negative signals)

---

## Architecture

```
/
├── index.html                   # Full frontend (HTML/CSS/JS)
├── netlify.toml                 # Routes /api/* → /.netlify/functions/*
└── netlify/functions/
    ├── intel.js                 # POST /api/intel — calls Anthropic API
    └── db.js                    # GET/POST /api/db  — Netlify Blobs storage
```

### Environment variables required

| Variable            | Description                        |
|---------------------|------------------------------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (sk-ant-…) |

---

## Local development

```bash
npm install -g netlify-cli
netlify dev
```

Then open http://localhost:8888. Set your API key in a `.env` file:

```
ANTHROPIC_API_KEY=sk-ant-...
```

> Note: Netlify Blobs requires a deployed site for full persistence. In local dev, data is stored in memory and lost on restart. For local persistence, `netlify dev` will use a local Blobs emulator if you're logged into the Netlify CLI.

---

## Upgrading storage (optional)

The current setup uses Netlify Blobs — a simple key/value store that's free and zero-config. If your team grows and you need more sophisticated querying (e.g., per-user flags, audit logs), the `db.js` function is the only file to change. Drop-in replacements: Supabase, PlanetScale, or Upstash Redis.
