# University Signal Intelligence

AI-powered institutional signal detection for U.S. universities. Analyzes 10 risk and opportunity categories from real news using Claude with web search.

## Live

Visit the deployed site — no setup needed.

## What it does

Enter any U.S. university and get an instant intelligence briefing covering:

| Category | What it tracks |
|---|---|
| Lost Research Grants | NIH, NSF, federal funding cuts |
| Major New Grants & Gifts | Philanthropy, awards, donations |
| Enrollment Growth | Record applications, yield increases |
| Enrollment Decline | Falling applications, shrinking classes |
| Leadership Turnover | President, provost, dean changes |
| Scandals & Investigations | Lawsuits, misconduct, controversies |
| Budget Cuts & Layoffs | Hiring freezes, deficits, restructuring |
| Accreditation / Regulatory | Compliance issues, federal scrutiny |
| Labor & Faculty Unrest | Strikes, union actions, no-confidence |
| Program Closures | Department cuts, major eliminations |

Each category gets a signal rating (positive / negative / mixed / unclear / none) backed by specific findings from recent news.

## Export

Click **Export PDF** to download a formatted dark-themed PDF report — generated entirely client-side with zero external libraries.

## Architecture

```
index.html                     # Frontend (single file, no build step)
netlify.toml                   # Netlify config
netlify/functions/analyze.js   # Serverless function (proxies to Anthropic API)
```

The frontend calls a Netlify Function which proxies requests to the Anthropic API. The API key is stored as a Netlify environment variable — never exposed to the browser.

## Deploy your own

1. Fork this repo
2. Connect to Netlify
3. Add environment variable: `ANTHROPIC_API_KEY` = your key
4. Deploy — that's it

### Netlify settings

- **Build command**: (leave empty)
- **Publish directory**: `.`
- **Functions directory**: `netlify/functions` (auto-detected from `netlify.toml`)

## Local development

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Run locally
netlify dev
```

Open `http://localhost:8888`

## Cost

Each analysis makes one Claude Sonnet API call with web search. Typical cost is ~$0.05–0.15 per analysis depending on the volume of news found.

## Privacy

- No user data is stored or logged
- No analytics or tracking
- The API key exists only as a Netlify environment variable

## License

MIT
