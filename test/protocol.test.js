import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleMessage, PROTOCOL_VERSION, SERVER_INFO, INSTRUCTIONS, TOOLS } from "../protocol.js";

test("initialize returns serverInfo with a description and instructions", async () => {
  const res = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.equal(res.result.serverInfo.name, "ai-readiness");
  assert.equal(typeof res.result.serverInfo.description, "string");
  assert.ok(res.result.serverInfo.description.length > 0);
  assert.equal(typeof res.result.instructions, "string");
  assert.ok(res.result.instructions.length > 0);
  assert.deepEqual(res.result.capabilities, { tools: {} });
  assert.equal(res.result.protocolVersion, PROTOCOL_VERSION);
});

test("initialize with a missing protocolVersion offer returns the declared supported version", async () => {
  const res = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.equal(PROTOCOL_VERSION, "2024-11-05");
  assert.equal(res.result.protocolVersion, PROTOCOL_VERSION);
});

test("initialize with the exact supported protocolVersion returns that same version", async () => {
  const res = await handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: PROTOCOL_VERSION },
  });
  assert.equal(res.result.protocolVersion, PROTOCOL_VERSION);
});

test("initialize with a future protocolVersion offer returns the declared supported version, not the echo", async () => {
  for (const protocolVersion of ["2025-03-26", "2025-11-25", "2026-07-28"]) {
    const res = await handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion },
    });
    assert.equal(res.result.protocolVersion, PROTOCOL_VERSION, `offer ${protocolVersion}`);
    assert.notEqual(res.result.protocolVersion, protocolVersion);
  }
});

test("initialize with a bogus protocolVersion offer returns the declared supported version, not the echo", async () => {
  for (const protocolVersion of ["", "1.0.0", "not-a-version", "latest"]) {
    const res = await handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion },
    });
    assert.equal(res.result.protocolVersion, PROTOCOL_VERSION, `offer ${JSON.stringify(protocolVersion)}`);
    assert.notEqual(res.result.protocolVersion, protocolVersion);
  }
});

test("docs do not claim this two-tool server is hosted at the live apex /mcp", () => {
  for (const rel of ["README.md", "docs/build-a-dependency-free-mcp-server.md"]) {
    const text = readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
    assert.equal(text.includes("https://samedaydesk.com/mcp"), false, rel);
    assert.equal(text.includes("params?.protocolVersion"), false, rel);
  }
});

test("docs label http.js as a custom JSON-RPC-over-HTTP adapter, not Streamable HTTP or one tool", () => {
  const required = [
    "minimal stateless custom JSON-RPC-over-HTTP POST adapter",
    "not MCP Streamable HTTP",
    "ordinary Streamable HTTP clients cannot use it as-is",
  ];
  const forbidden = [
    "one clean tool",
    "over Streamable HTTP",
    "hosted **Streamable HTTP**",
    "stdio **and** remote (Streamable HTTP)",
    "The Streamable HTTP transport can be a single",
    "speaks both transports",
  ];
  for (const rel of ["README.md", "docs/build-a-dependency-free-mcp-server.md"]) {
    const text = readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
    for (const phrase of required) {
      assert.ok(text.includes(phrase), `${rel} must contain ${JSON.stringify(phrase)}`);
    }
    for (const phrase of forbidden) {
      assert.equal(text.includes(phrase), false, `${rel} must not contain ${JSON.stringify(phrase)}`);
    }
  }
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.ok(readme.includes("two focused tools"));
});

test("protocol.js and http.js do not claim Streamable HTTP or a remote mcpServers URL", () => {
  const protocolSrc = readFileSync(new URL("../protocol.js", import.meta.url), "utf8");
  const httpSrc = readFileSync(new URL("../http.js", import.meta.url), "utf8");
  const truthfulDescription = "Dependency-free; stdio plus a custom JSON-RPC-over-HTTP POST adapter.";
  assert.ok(protocolSrc.includes(truthfulDescription), "protocol.js must contain the truthful SERVER_INFO.description");
  assert.ok(SERVER_INFO.description.includes(truthfulDescription));
  assert.equal(protocolSrc.includes("stdio and streamable HTTP transports"), false);
  assert.equal(/streamable HTTP/i.test(protocolSrc), false);

  const requiredHttp = [
    "minimal custom JSON-RPC-over-HTTP POST adapter",
    "not MCP Streamable HTTP",
    "not directly compatible with ordinary Streamable HTTP clients",
  ];
  for (const phrase of requiredHttp) {
    assert.ok(httpSrc.includes(phrase), `http.js must contain ${JSON.stringify(phrase)}`);
  }
  const forbiddenHttp = [
    "Streamable HTTP transport",
    "ai-readiness MCP server (Streamable HTTP)",
    '{ "mcpServers": { "ai-readiness": { "url": "<this-url>/mcp" } } }',
    "Add to an MCP client that supports remote servers",
  ];
  for (const phrase of forbiddenHttp) {
    assert.equal(httpSrc.includes(phrase), false, `http.js must not contain ${JSON.stringify(phrase)}`);
  }
});

test("SERVER_INFO and INSTRUCTIONS are exported and non-empty", () => {
  assert.ok(SERVER_INFO.description.length > 0);
  assert.ok(SERVER_INFO.websiteUrl.startsWith("https://"));
  assert.ok(INSTRUCTIONS.length > 0);
});

test("tools/list returns both tools with url as a required input", async () => {
  const res = await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const names = res.result.tools.map((t) => t.name);
  assert.deepEqual(names.sort(), ["check_ai_readiness", "generate_ai_readiness_fixes"]);
  for (const t of res.result.tools) {
    assert.ok(t.description.length > 0);
    assert.deepEqual(t.inputSchema.required, ["url"]);
  }
  assert.equal(TOOLS.length, 2);
});

test("ping returns an empty result", async () => {
  const res = await handleMessage({ jsonrpc: "2.0", id: 3, method: "ping", params: {} });
  assert.deepEqual(res.result, {});
});

test("notifications/initialized produces no reply", async () => {
  assert.equal(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
});

test("unknown method with an id returns method-not-found", async () => {
  const res = await handleMessage({ jsonrpc: "2.0", id: 4, method: "does/not/exist" });
  assert.equal(res.error.code, -32601);
});

test("tools/call with an unknown tool returns invalid-params", async () => {
  const res = await handleMessage({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope", arguments: {} } });
  assert.equal(res.error.code, -32602);
});

test("tools/call without a url is a handled tool error, not a crash", async () => {
  const res = await handleMessage({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "check_ai_readiness", arguments: {} } });
  assert.equal(res.result.isError, true);
  assert.ok(res.result.content[0].text.length > 0);
});
