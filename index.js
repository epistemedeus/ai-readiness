#!/usr/bin/env node
// ai-readiness CLI — thin wrapper. Core logic lives in lib.js (shared with mcp.js).
import { run } from "./lib.js";

const args = process.argv.slice(2);

// `ai-readiness mcp` (or --mcp) launches the MCP server instead of the CLI. This
// keeps the npx invocation simple+reliable for MCP clients:
//   npx -y github:epistemedeus/ai-readiness mcp
if (args[0] === "mcp" || args.includes("--mcp")) {
  await import("./mcp.js");
} else {
  await cli();
}

async function cli() {
const asJson = args.includes("--json");
const url = args.find((a) => !a.startsWith("--"));
const C = { reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m" };
const ICON = { pass: `${C.green}PASS${C.reset}`, warn: `${C.yellow}WARN${C.reset}`, fail: `${C.red}FAIL${C.reset}` };
try {
  const r = await run(url, asJson);
  if (asJson) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
  console.log(`\n${C.bold}AI Readiness${C.reset} ${C.dim}${r.url}${C.reset}`);
  console.log(`${C.bold}Score ${r.score}/100  Grade ${r.grade}${C.reset}\n`);
  for (const c of r.checks) {
    console.log(`  ${ICON[c.status]}  ${C.bold}${c.label}${C.reset}  ${C.dim}${c.detail}${C.reset}`);
    if (c.fix) console.log(`        ${C.cyan}fix:${C.reset} ${c.fix}`);
  }
  console.log(`\n${C.dim}Run it in your browser (no install):${C.reset} https://samedaydesk.com/tools/ai-readiness`);
  console.log(`${C.dim}Want the deep audit (real citation testing vs competitors)? ${C.reset}https://samedaydesk.com/  ${C.dim}(AI-Search Visibility Audit)${C.reset}\n`);
} catch (e) {
  console.error(`${C.red}Error:${C.reset} ${e.message}`);
  process.exit(1);
}
}
