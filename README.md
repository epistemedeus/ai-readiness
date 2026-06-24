# ai-readiness

**Is your website visible to AI search?** A tiny, dependency-free CLI that checks whether ChatGPT, Perplexity, Claude, and Google AI can crawl and understand your site, and tells you exactly what to fix.

```bash
npx github:epistemedeus/ai-readiness yoursite.com
```

No install, no signup, no dependencies. Node 18+.

> Prefer a browser? Run the same check (no install) at **[samedaydesk.com/tools/ai-readiness](https://samedaydesk.com/tools/ai-readiness)**.

## Dataset: 136 companies scored for AI-search readiness (June 2026)

We ran this checker against the homepages of **136 well-known companies across 7 industries** and published the full results. Open data, free to use with attribution.

- **Full CSV:** [`data/ai-search-readiness-2026.csv`](data/ai-search-readiness-2026.csv)
- **Interactive, sortable leaderboard:** [samedaydesk.com — AI-Search Readiness Leaderboard](https://samedaydesk.com/reports/ai-search-readiness-leaderboard-2026.html)

**Average score by industry (lower = harder for AI search to read):**

| Industry | Avg score | n |
|---|---|---|
| Marketing agencies | 92 | 24 |
| SaaS | 88 | 24 |
| Dev tools | 86 | 17 |
| E-commerce | 85 | 19 |
| AI startups | 83 | 25 |
| Fintech | 74 | 16 |
| Healthtech | 63 | 11 |

**Notable findings:** Healthtech is the least AI-search-ready industry (avg 63). Klarna scored an F (38); GitHub, Chime, Ramp, Gusto, Ro, Hims and Zocdoc each scored a D. Even some AI companies struggle — Perplexity scored a C and LlamaIndex a D. Most gaps are the same and entirely fixable: JavaScript-only homepages, missing JSON-LD structured data, and no sitemap.

Per-industry write-ups: [SaaS](https://samedaydesk.com/reports/ai-search-readiness-saas-2026.html) · [e-commerce](https://samedaydesk.com/reports/ai-search-readiness-ecommerce-2026.html) · [marketing agencies](https://samedaydesk.com/reports/ai-search-readiness-marketing-agencies-2026.html) · [AI startups](https://samedaydesk.com/reports/ai-search-readiness-ai-startups-2026.html) · [healthtech](https://samedaydesk.com/reports/ai-search-readiness-healthtech-2026.html).


## Why this matters

AI search is becoming how people find things, and AI answers are pulled from a small set of pages that are **crawlable and well-structured**. If GPTBot is blocked in your `robots.txt`, or your pages have no structured data, you can be invisible in AI answers no matter how good your site looks to humans. This tool checks the technical fundamentals that decide whether you're even eligible to be cited.

## What it checks

| Check | Why it matters |
|---|---|
| **AI crawler access** | Whether `GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`, `Bingbot` are allowed in `robots.txt`. Blocked = invisible. |
| **Structured data (JSON-LD)** | AI engines use JSON-LD (`Organization`, `FAQPage`, `Article`) to classify and quote your content. |
| **Title & meta description** | Present and well-sized, so engines have a clean summary to work with. |
| **Open Graph tags** | Richer machine-readable context and clean link previews. |
| **XML sitemap** | Helps engines discover your pages; submit it in Bing Webmaster Tools (ChatGPT Search reads the Bing index). |
| **llms.txt** | Flagged as cheap hygiene only. Honest note: it has **no proven effect on AI citations** yet, so don't let anyone sell it to you as a ranking boost. |

You get a 0-100 score, a letter grade, and a concrete fix for every failing check.

## Example

```
$ npx github:epistemedeus/ai-readiness example.com

AI Readiness  https://example.com/
Score 72/100  Grade B

  PASS  AI crawler access  No AI crawler blocked.
  FAIL  Structured data (JSON-LD)  None found.
        fix: Add Organization + FAQPage + Article JSON-LD.
  PASS  Title & meta description  title 41 chars, description 132 chars
  WARN  Open Graph tags  2 og: tags
        fix: Add og:title, og:description, og:image, og:url.
  PASS  XML sitemap  found
  WARN  llms.txt  none (minor: no proven citation effect)
```

JSON output for scripting: `npx github:epistemedeus/ai-readiness yoursite.com --json`

## Use as an MCP server

Add the checker to any [Model Context Protocol](https://modelcontextprotocol.io) client (Claude Desktop, Cursor, Cline, etc.) so you can ask your AI assistant *"is my site visible to AI search?"* and get a scored report inline. Dependency-free, runs over stdio.

```json
{
  "mcpServers": {
    "ai-readiness": {
      "command": "npx",
      "args": ["-y", "github:epistemedeus/ai-readiness", "mcp"]
    }
  }
}
```

It exposes two tools:
- `check_ai_readiness(url)` — returns the score, grade, and a specific fix for each gap.
- `generate_ai_readiness_fixes(url)` — generates starter Organization + FAQPage JSON-LD (pre-filled from the site) and an AI-crawler-friendly robots.txt.

### No install (hosted / remote)

If your client supports remote MCP servers (e.g. ChatGPT connectors, Claude.ai custom connectors), point it at the hosted endpoint — nothing to install:

```json
{ "mcpServers": { "ai-readiness": { "url": "https://samedaydesk.com/mcp" } } }
```

## Use in CI (GitHub Action)

Fail-fast on AI-search regressions by checking a URL on every deploy:

```yaml
- uses: epistemedeus/ai-readiness@v1
  with:
    url: https://yoursite.com
```

## The deep version

This CLI checks the technical basics. The questions it **can't** answer from your markup: *do ChatGPT, Perplexity, and Google AI actually cite you for the queries your buyers type? How do you compare to named competitors? What's the highest-ROI fix first?*

That's the **AI-Search Visibility Audit** from SameDayDesk: real citation testing across engines, a competitor benchmark, and a prioritized fix list as a PDF and web report, delivered same day. → **[samedaydesk.com](https://samedaydesk.com/)**

## License

MIT © Neomorphic LLC ([SameDayDesk](https://samedaydesk.com/))
