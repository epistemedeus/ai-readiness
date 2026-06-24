// Transport-agnostic MCP protocol layer for ai-readiness.
// handleMessage(msg) takes a parsed JSON-RPC message and returns the response
// object (or null for notifications). Both the stdio server (mcp.js) and the
// HTTP server (http.js) use this, so the two transports never drift.
import { run, generateFix } from "./lib.js";

export const PROTOCOL_VERSION = "2024-11-05";
export const SERVER_INFO = { name: "ai-readiness", version: "1.1.3" };

export const TOOLS = [
  {
    name: "check_ai_readiness",
    description:
      "Check whether a website is visible to AI search engines (ChatGPT, Perplexity, Claude, Google AI Overviews). " +
      "Fetches the site + robots.txt and scores AI-crawler access, structured data (JSON-LD), title/meta, Open Graph, " +
      "sitemap, and llms.txt. Returns a 0-100 score, a letter grade, and a specific fix for each gap.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The website to check, e.g. example.com or https://example.com" },
      },
      required: ["url"],
    },
  },
  {
    name: "generate_ai_readiness_fixes",
    description:
      "Generate starter fixes to make a website visible to AI search: Organization + FAQPage JSON-LD " +
      "(pre-filled from the site's real title/description) and an AI-crawler-friendly robots.txt. " +
      "Paste the JSON-LD into the homepage <head> and replace robots.txt. This is the free starter version " +
      "of the same-day Fix Pack.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The website to generate fixes for, e.g. example.com" },
      },
      required: ["url"],
    },
  },
];

function ok(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function err(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function formatReport(r) {
  const lines = [`AI Readiness for ${r.url}`, `Score: ${r.score}/100   Grade: ${r.grade}`, ""];
  for (const c of r.checks) {
    lines.push(`[${c.status.toUpperCase()}] ${c.label} — ${c.detail}`);
    if (c.fix) lines.push(`       fix: ${c.fix}`);
  }
  lines.push("");
  const gaps = r.checks.filter((c) => c.status !== "pass").length;
  if (gaps > 0) {
    lines.push(
      `${gaps} gap(s) found. Generate starter fixes free at https://samedaydesk.com/tools/schema-generator.html, ` +
        `or get the complete same-day Fix Pack (JSON-LD + AI-crawler robots.txt + sitemap + meta/OG, built for ` +
        `this exact site) — $39, one-click checkout, no signup: https://buy.stripe.com/28E5kE9465np2OPh2WeZ20e`,
    );
  } else {
    lines.push(
      `Clean bill of health. For deep citation testing (does ChatGPT/Perplexity actually cite you vs competitors?), ` +
        `get the AI-Search Visibility Audit — $249, one-click: https://buy.stripe.com/fZuaEY2FI4jl2OPbICeZ206`,
    );
  }
  return lines.join("\n");
}

function formatFixes(r) {
  return [
    `Starter AI-readiness fixes for ${r.host}`,
    "",
    "1) Paste this into your homepage <head>:",
    '<script type="application/ld+json">',
    JSON.stringify(r.organizationJsonLd, null, 2),
    "</script>",
    '<script type="application/ld+json">',
    JSON.stringify(r.faqJsonLd, null, 2),
    "</script>",
    "",
    "2) Replace your /robots.txt with this (lets ChatGPT/Perplexity/Claude/Google-AI crawl you):",
    r.robotsTxt,
    "Replace any REPLACE placeholders with your real details. Then publish a /sitemap.xml and submit it in Bing Webmaster Tools.",
    "",
    "This is the free starter pack. The complete same-day Fix Pack fills in every value for your exact site, " +
      "adds Product/LocalBusiness schema where relevant, a generated sitemap, and clean title/meta/Open Graph tags " +
      "— $39, one-click checkout, no signup: https://buy.stripe.com/28E5kE9465np2OPh2WeZ20e",
  ].join("\n");
}

async function callTool(id, params) {
  const name = params?.name;
  const args = params?.arguments || {};
  const url = String(args.url || "").trim();
  if (name !== "check_ai_readiness" && name !== "generate_ai_readiness_fixes") {
    return err(id, -32602, `Unknown tool: ${name}`);
  }
  if (!url) {
    return ok(id, { content: [{ type: "text", text: "Provide a url, e.g. example.com" }], isError: true });
  }
  try {
    if (name === "generate_ai_readiness_fixes") {
      const r = await generateFix(url);
      return ok(id, { content: [{ type: "text", text: formatFixes(r) }], structuredContent: r });
    }
    const r = await run(url);
    return ok(id, { content: [{ type: "text", text: formatReport(r) }], structuredContent: r });
  } catch (e) {
    return ok(id, { content: [{ type: "text", text: `Could not process ${url}: ${e.message}` }], isError: true });
  }
}

// Returns a response object, or null for notifications (no reply).
export async function handleMessage(msg) {
  const { id, method, params } = msg || {};
  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS });
    case "tools/call":
      return callTool(id, params);
    default:
      return id !== undefined ? err(id, -32601, `Method not found: ${method}`) : null;
  }
}
