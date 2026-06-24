# How to build a dependency-free MCP server (stdio + remote) and publish it to the registry

This repo's MCP server has no dependencies, speaks both transports (local **stdio** and hosted **Streamable HTTP**), and is listed in the [official MCP registry](https://registry.modelcontextprotocol.io). Here's exactly how it's built, so you can copy the pattern. Everything below is real, working code from this repository.

## 1. Keep the protocol layer transport-agnostic

MCP is just JSON-RPC 2.0. Put the message handling in one place and let each transport call it. `handleMessage(msg)` returns a response object (or `null` for notifications):

```js
export async function handleMessage(msg) {
  const { id, method, params } = msg || {};
  switch (method) {
    case "initialize":
      return { jsonrpc: "2.0", id, result: {
        protocolVersion: params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "your-server", version: "1.0.0" },
      }};
    case "notifications/initialized": return null;   // notifications get no reply
    case "ping":        return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":  return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    case "tools/call":  return callTool(id, params);
    default: return id !== undefined
      ? { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } }
      : null;
  }
}
```

A tool result is `{ content: [{ type: "text", text }], structuredContent }`. Set `isError: true` for tool-level failures (not protocol errors).

## 2. stdio transport: newline-delimited JSON, no SDK

The stdio transport is newline-delimited JSON-RPC on stdin/stdout. **stdout is protocol-only — all logging goes to stderr.** Track in-flight requests so a piped client doesn't exit before async work finishes:

```js
import { handleMessage } from "./protocol.js";
let buf = "", pending = 0, ended = false;
const maybeExit = () => { if (ended && pending === 0) process.exit(0); };
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk; let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    pending++;
    Promise.resolve(handleMessage(msg))
      .then((res) => { if (res) process.stdout.write(JSON.stringify(res) + "\n"); })
      .finally(() => { pending--; maybeExit(); });
  }
});
process.stdin.on("end", () => { ended = true; maybeExit(); });
```

## 3. Remote transport: one HTTP endpoint, stateless

The Streamable HTTP transport can be a single `POST` that returns the JSON-RPC response as `application/json` (you only need SSE if you stream). Stateless servers can skip session IDs. Enable CORS so browser-based clients (ChatGPT connectors, Claude.ai custom connectors) can reach it:

```js
// POST /mcp  ->  res.json(await handleMessage(req.body))   // notifications -> 202
```

Now the same server works locally (`stdio`) and as a hosted URL.

## 4. Ship it: MCPB bundle + registry, fully from CI

- **MCPB** (one-click install): zip `manifest.json` + your server files; attach to a GitHub Release. The registry accepts `mcpb` packages hosted on GitHub Releases.
- **Publish from GitHub Actions with OIDC** — no tokens to manage. On a `v*` tag: build the bundle, generate `server.json` (with the `fileSha256`), then `mcp-publisher login github-oidc && mcp-publisher publish`. Namespace is `io.github.<you>`.
- **Remote listing**: verify your domain with `mcp-publisher login http --domain you.com` (serve the proof at `/.well-known/mcp-registry-auth`) and publish a `remotes` entry under `com.you`.

Two gotchas that cost real time: the registry `description` must be **≤100 chars**, and if you split code across files, make sure the **bundle includes every imported file** (a missing `protocol.js` breaks the published server silently).

## Want one built for you?

If you'd rather not do this, we build production MCP servers for your API or product — dependency-free, stdio + optional hosted remote, registry/manifest setup included. **Custom MCP Server, $349, delivered fast** → [samedaydesk.com](https://samedaydesk.com/) ([buy directly](https://buy.stripe.com/14A4gA6VY7vxahh6oieZ20d)).

— Built by [SameDayDesk](https://samedaydesk.com/) (Neomorphic LLC). The full working code is in [this repo](https://github.com/epistemedeus/ai-readiness): `protocol.js`, `mcp.js`, `http.js`, `.github/workflows/publish-mcp.yml`.
