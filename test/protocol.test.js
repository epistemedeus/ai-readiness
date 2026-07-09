import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMessage, SERVER_INFO, INSTRUCTIONS, TOOLS } from "../protocol.js";

test("initialize returns serverInfo with a description and instructions", async () => {
  const res = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.equal(res.result.serverInfo.name, "ai-readiness");
  assert.equal(typeof res.result.serverInfo.description, "string");
  assert.ok(res.result.serverInfo.description.length > 0);
  assert.equal(typeof res.result.instructions, "string");
  assert.ok(res.result.instructions.length > 0);
  assert.deepEqual(res.result.capabilities, { tools: {} });
});

test("initialize echoes the client's requested protocol version", async () => {
  const res = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } });
  assert.equal(res.result.protocolVersion, "2025-03-26");
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
