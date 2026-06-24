#!/usr/bin/env node
// ai-readiness MCP server — stdio transport. Exposes the AI-search readiness
// checker as MCP tools so any MCP client (Claude Desktop, Cursor, Cline, etc.)
// can check/fix a site. Protocol logic is shared with the HTTP server in
// protocol.js. Dependency-free; logs go to stderr only.
//
// Run:  npx -y github:epistemedeus/ai-readiness mcp
import { handleMessage } from "./protocol.js";

function write(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
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
      continue;
    }
    pending++;
    Promise.resolve(handleMessage(msg))
      .then((res) => {
        if (res) write(res);
      })
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
