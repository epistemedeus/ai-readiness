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
import { run } from "./lib.js";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "ai-readiness", version: "1.1.0" };

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

async function handleToolCall(id, params) {
  const name = params?.name;
  const args = params?.arguments || {};
  if (name !== "check_ai_readiness") {
    return error(id, -32602, `Unknown tool: ${name}`);
  }
  const url = String(args.url || "").trim();
  if (!url) {
    return result(id, { content: [{ type: "text", text: "Provide a url, e.g. example.com" }], isError: true });
  }
  try {
    const r = await run(url);
    const text = formatReport(r);
    // Return both human-readable text and the structured data.
    return result(id, {
      content: [{ type: "text", text }],
      structuredContent: r,
    });
  } catch (e) {
    return result(id, {
      content: [{ type: "text", text: `Could not check ${url}: ${e.message}` }],
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
