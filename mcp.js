#!/usr/bin/env node
// ai-readiness MCP server — exposes the AI-search readiness checker as a Model
// Context Protocol tool, so any MCP client (Claude Desktop, Cursor, Cline, etc.)
// can check whether a website is visible to AI search engines.
//
// Dependency-free: speaks MCP's stdio transport (newline-delimited JSON-RPC 2.0)
// by hand, matching the zero-dependency ethos of the CLI. Logs go to stderr only;
// stdout carries protocol messages exclusively.
//
// Run:  npx -y github:epistemedeus/ai-readiness ai-readiness-mcp
import { run, generateFix } from "./lib.js";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "ai-readiness", version: "1.1.2" };

const TOOLS = [
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

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}
function result(id, res) {
  send({ jsonrpc: "2.0", id, result: res });
}
function error(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function formatReport(r) {
  const lines = [];
  lines.push(`AI Readiness for ${r.url}`);
  lines.push(`Score: ${r.score}/100   Grade: ${r.grade}`);
  lines.push("");
  for (const c of r.checks) {
    lines.push(`[${c.status.toUpperCase()}] ${c.label} — ${c.detail}`);
    if (c.fix) lines.push(`       fix: ${c.fix}`);
  }
  lines.push("");
  const gaps = r.checks.filter((c) => c.status !== "pass").length;
  if (gaps > 0) {
    lines.push(
      `${gaps} gap(s) found. Generate the fixes free at https://samedaydesk.com/tools/schema-generator.html, ` +
        `or have the complete Fix Pack (JSON-LD + AI-crawler robots.txt + sitemap + meta/OG, built for this exact ` +
        `site, same day) done for $39: https://samedaydesk.com/`,
    );
  } else {
    lines.push(
      `Clean bill of health. For deep citation testing (does ChatGPT/Perplexity actually cite you vs competitors?), ` +
        `see the AI-Search Visibility Audit at https://samedaydesk.com/`,
    );
  }
  return lines.join("\n");
}

function formatFixes(r) {
  return [
    `Starter AI-readiness fixes for ${r.host}`,
    "",
    "1) Paste this into your homepage <head>:",
    "<script type=\"application/ld+json\">",
    JSON.stringify(r.organizationJsonLd, null, 2),
    "</script>",
    "<script type=\"application/ld+json\">",
    JSON.stringify(r.faqJsonLd, null, 2),
    "</script>",
    "",
    "2) Replace your /robots.txt with this (lets ChatGPT/Perplexity/Claude/Google-AI crawl you):",
    r.robotsTxt,
    "Replace any REPLACE placeholders with your real details. Then publish a /sitemap.xml and submit it in Bing Webmaster Tools.",
    "",
    "This is the free starter pack. The complete, same-day Fix Pack ($39) fills in every value for your exact site, " +
      "adds Product/LocalBusiness schema where relevant, a generated sitemap, and clean title/meta/Open Graph tags: https://samedaydesk.com/",
  ].join("\n");
}

async function handleToolCall(id, params) {
  const name = params?.name;
  const args = params?.arguments || {};
  const url = String(args.url || "").trim();
  if (name !== "check_ai_readiness" && name !== "generate_ai_readiness_fixes") {
    return error(id, -32602, `Unknown tool: ${name}`);
  }
  if (!url) {
    return result(id, { content: [{ type: "text", text: "Provide a url, e.g. example.com" }], isError: true });
  }
  try {
    if (name === "generate_ai_readiness_fixes") {
      const r = await generateFix(url);
      return result(id, { content: [{ type: "text", text: formatFixes(r) }], structuredContent: r });
    }
    const r = await run(url);
    return result(id, { content: [{ type: "text", text: formatReport(r) }], structuredContent: r });
  } catch (e) {
    return result(id, {
      content: [{ type: "text", text: `Could not process ${url}: ${e.message}` }],
      isError: true,
    });
  }
}

async function dispatch(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case "initialize":
      return result(id, {
        protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "notifications/initialized":
    case "notifications/cancelled":
      return; // notifications: no response
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, { tools: TOOLS });
    case "tools/call":
      return handleToolCall(id, params);
    default:
      if (id !== undefined) error(id, -32601, `Method not found: ${method}`);
      return;
  }
}

let buf = "";
let pending = 0;
let ended = false;
function maybeExit() {
  if (ended && pending === 0) process.exit(0);
}
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue; // ignore malformed lines
    }
    pending++;
    Promise.resolve(dispatch(msg))
      .catch((e) => process.stderr.write(`[ai-readiness-mcp] ${e.message}\n`))
      .finally(() => {
        pending--;
        maybeExit();
      });
  }
});
process.stdin.on("end", () => {
  ended = true;
  maybeExit();
});
process.stderr.write("[ai-readiness-mcp] ready on stdio\n");
