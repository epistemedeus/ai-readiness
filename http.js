#!/usr/bin/env node
// ai-readiness MCP server — Streamable HTTP transport. Lets remote/web MCP
// clients (ChatGPT connectors, Claude.ai custom connectors, etc.) that can't run
// a local stdio process use the checker over HTTPS. Stateless + CORS-enabled.
// Protocol logic is shared with the stdio server via protocol.js.
//
// POST /mcp  with a JSON-RPC message  -> JSON-RPC response (application/json)
// GET  /     -> small landing/health page
import http from "node:http";
import { SERVER_INFO, handleMessage } from "./protocol.js";

const PORT = process.env.PORT || 8080;
const MAX_BODY = 1_000_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      data += c;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const LANDING = `ai-readiness MCP server (Streamable HTTP)

Add to an MCP client that supports remote servers, e.g.:
  { "mcpServers": { "ai-readiness": { "url": "<this-url>/mcp" } } }

Tools: check_ai_readiness(url), generate_ai_readiness_fixes(url)
Free hosted UI + same-day Fix Pack: https://samedaydesk.com/tools/ai-readiness
`;

const server = http.createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }

  if (req.method === "GET" && (url === "/" || url === "/health")) {
    res.writeHead(200, { ...CORS, "Content-Type": "text/plain; charset=utf-8" });
    return res.end(url === "/health" ? "ok" : LANDING);
  }

  if (req.method === "POST" && (url === "/mcp" || url === "/")) {
    let body;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(413, { ...CORS, "Content-Type": "application/json" });
      return res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Body too large" } }));
    }
    let msg;
    try {
      msg = JSON.parse(body);
    } catch {
      res.writeHead(400, { ...CORS, "Content-Type": "application/json" });
      return res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }));
    }
    try {
      // Support a single message or a JSON-RPC batch (array).
      if (Array.isArray(msg)) {
        const out = (await Promise.all(msg.map(handleMessage))).filter(Boolean);
        res.writeHead(out.length ? 200 : 202, { ...CORS, "Content-Type": "application/json" });
        return res.end(out.length ? JSON.stringify(out) : "");
      }
      const out = await handleMessage(msg);
      if (!out) {
        res.writeHead(202, CORS);
        return res.end();
      }
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      return res.end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(500, { ...CORS, "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({ jsonrpc: "2.0", id: msg?.id ?? null, error: { code: -32603, message: e.message } }),
      );
    }
  }

  res.writeHead(404, { ...CORS, "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[ai-readiness] ${SERVER_INFO.name} v${SERVER_INFO.version} HTTP MCP on :${PORT}`);
});
