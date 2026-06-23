# ai-readiness

**Is your website visible to AI search?** A tiny, dependency-free CLI that checks whether ChatGPT, Perplexity, Claude, and Google AI can crawl and understand your site, and tells you exactly what to fix.

```bash
npx github:epistemedeus/ai-readiness yoursite.com
```

No install, no signup, no dependencies. Node 18+.

> Prefer a browser? Run the same check (no install) at **[samedaydesk.com/tools/ai-readiness](https://samedaydesk.com/tools/ai-readiness)**.

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
