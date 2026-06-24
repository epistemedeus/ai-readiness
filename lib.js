// ai-readiness — is your website visible to AI search (ChatGPT, Perplexity, Claude, Google AI)?
// Dependency-free. Usage: npx github:epistemedeus/ai-readiness yoursite.com [--json]
import dns from "node:dns/promises";
import net from "node:net";

export const AI_CRAWLERS = [
  { ua: "GPTBot", who: "ChatGPT (OpenAI index/training)" },
  { ua: "OAI-SearchBot", who: "ChatGPT Search" },
  { ua: "ClaudeBot", who: "Claude" },
  { ua: "PerplexityBot", who: "Perplexity" },
  { ua: "Google-Extended", who: "Google Gemini & AI Overviews" },
  { ua: "CCBot", who: "Common Crawl (feeds many LLMs)" },
  { ua: "Bingbot", who: "Bing (powers ChatGPT Search results)" },
];
const UA = "ai-readiness/1.0 (+https://github.com/epistemedeus/ai-readiness)";
const TIMEOUT = 10000, MAX_BYTES = 2_500_000;

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  if (net.isIPv6(ip)) { const v = ip.toLowerCase(); return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:"); }
  return true;
}
function normalizeUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) throw new Error("Usage: ai-readiness <url> [--json]");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  const u = new URL(s);
  if (!u.hostname.includes(".")) throw new Error("Enter a full domain, e.g. example.com");
  return u;
}
async function assertPublic(hostname) {
  if (net.isIP(hostname)) { if (isPrivateIp(hostname)) throw new Error("Not a public host"); return; }
  const addrs = await dns.lookup(hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("Not a public host");
}
async function fetchText(url, html = false) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { signal: c.signal, redirect: "follow", headers: { "User-Agent": UA, Accept: html ? "text/html,*/*" : "text/plain,*/*" } });
    const buf = Buffer.from((await r.arrayBuffer()).slice(0, MAX_BYTES));
    return { ok: r.ok, status: r.status, finalUrl: r.url, body: buf.toString("utf8") };
  } finally { clearTimeout(t); }
}
function robotsBlocks(txt, uaName) {
  if (!txt) return false;
  const lines = txt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  const groups = []; let cur = null;
  for (const line of lines) {
    const m = line.match(/^(user-agent|disallow|allow)\s*:\s*(.*)$/i); if (!m) continue;
    const f = m[1].toLowerCase(), v = m[2].trim();
    if (f === "user-agent") { if (cur && cur.rules.length) { groups.push(cur); cur = null; } if (!cur) cur = { agents: [], rules: [] }; cur.agents.push(v.toLowerCase()); }
    else if (cur) cur.rules.push({ type: f, path: v });
  }
  if (cur) groups.push(cur);
  const want = uaName.toLowerCase();
  const g = groups.find((x) => x.agents.includes(want)) || groups.find((x) => x.agents.includes("*"));
  if (!g) return false;
  const dis = g.rules.some((r) => r.type === "disallow" && (r.path === "/" || r.path === "/*"));
  const alw = g.rules.some((r) => r.type === "allow" && (r.path === "/" || r.path === ""));
  return dis && !alw;
}
const attr = (tag, name) => { const m = tag.match(new RegExp(name + '\\s*=\\s*["\']([^"\']*)["\']', "i")); return m ? m[1].trim() : null; };
function analyzeHtml(html) {
  const o = { title: null, description: null, og: 0, jsonld: [] };
  if (!html) return o;
  const tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); if (tm) o.title = tm[1].replace(/\s+/g, " ").trim();
  for (const tag of html.match(/<meta[^>]+>/gi) || []) {
    if ((attr(tag, "name") || "").toLowerCase() === "description") o.description = attr(tag, "content");
    if ((attr(tag, "property") || "").toLowerCase().startsWith("og:")) o.og++;
  }
  for (const b of html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || []) {
    try { const d = JSON.parse(b.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim());
      const arr = Array.isArray(d) ? d : d["@graph"] || [d];
      for (const n of arr) if (n && n["@type"]) o.jsonld.push([].concat(n["@type"]).join("/"));
    } catch { o.jsonld.push("(unparseable)"); }
  }
  return o;
}

export async function run(rawUrl, asJson) {
  const u = normalizeUrl(rawUrl); await assertPublic(u.hostname);
  const page = await fetchText(u.toString(), true);
  const origin = new URL(page.finalUrl || u.toString()).origin;
  let robots = null, hasSitemap = false, hasLlms = false;
  await Promise.all([
    fetchText(origin + "/robots.txt").then((r) => { if (r.ok) robots = r.body; }).catch(() => {}),
    fetchText(origin + "/sitemap.xml").then((r) => { hasSitemap = r.ok && /<urlset|<sitemapindex/i.test(r.body); }).catch(() => {}),
    fetchText(origin + "/llms.txt").then((r) => { hasLlms = r.ok && r.body.trim().length > 0; }).catch(() => {}),
  ]);
  if (!hasSitemap && robots && /^\s*sitemap\s*:/im.test(robots)) hasSitemap = true;
  const h = analyzeHtml(page.body);
  const blocked = AI_CRAWLERS.filter((c) => robotsBlocks(robots, c.ua));
  const valid = h.jsonld.filter((t) => t !== "(unparseable)");
  const checks = [];
  const add = (label, status, detail, fix) => checks.push({ label, status, detail, fix });

  add("AI crawler access", blocked.length === 0 ? "pass" : blocked.length >= AI_CRAWLERS.length ? "fail" : "warn",
    blocked.length === 0 ? (robots ? "No AI crawler blocked." : "No robots.txt; allowed by default.") : "Blocked: " + blocked.map((c) => c.ua).join(", "),
    blocked.length ? "Allow " + blocked.map((c) => c.ua).join(", ") + " in robots.txt." : null);
  add("Structured data (JSON-LD)", valid.length ? "pass" : h.jsonld.length ? "warn" : "fail",
    valid.length ? "Found: " + [...new Set(valid)].slice(0, 6).join(", ") : "None found.",
    valid.length ? null : "Add Organization + FAQPage + Article JSON-LD.");
  const titleOk = h.title && h.title.length >= 15 && h.title.length <= 65;
  const descOk = h.description && h.description.length >= 70 && h.description.length <= 165;
  add("Title & meta description", titleOk && descOk ? "pass" : (h.title || h.description ? "warn" : "fail"),
    `title ${h.title ? h.title.length + " chars" : "missing"}, description ${h.description ? h.description.length + " chars" : "missing"}`,
    titleOk && descOk ? null : "Use a 15-65 char title and a 70-165 char meta description.");
  add("Open Graph tags", h.og >= 3 ? "pass" : h.og ? "warn" : "fail", `${h.og} og: tags`, h.og >= 3 ? null : "Add og:title, og:description, og:image, og:url.");
  add("XML sitemap", hasSitemap ? "pass" : "fail", hasSitemap ? "found" : "none at root or in robots.txt", hasSitemap ? null : "Publish /sitemap.xml and submit it in Bing Webmaster Tools.");
  add("llms.txt", hasLlms ? "pass" : "warn", hasLlms ? "found" : "none (minor: no proven citation effect)", hasLlms ? null : "Optional hygiene; do not expect a ranking boost.");

  const W = [35, 22, 15, 8, 15, 5], P = { pass: 1, warn: 0.5, fail: 0 };
  let s = 0, m = 0; checks.forEach((c, i) => { s += W[i] * P[c.status]; m += W[i]; });
  const score = Math.round((s / m) * 100);
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  return { url: page.finalUrl || u.toString(), score, grade, checks };
}
