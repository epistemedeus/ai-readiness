import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isPrivateIp,
  normalizeUrl,
  robotsBlocks,
  analyzeHtml,
  scoreChecks,
  gradeFor,
  CHECK_WEIGHTS,
  AI_CRAWLERS,
} from "../lib.js";

test("isPrivateIp: private, loopback, link-local, and CGNAT ranges are private", () => {
  for (const ip of [
    "10.0.0.1", "127.0.0.1", "192.168.1.1", "172.16.0.1", "172.31.255.255",
    "169.254.1.1", "100.64.0.1", "100.127.255.255", "0.0.0.0",
  ]) {
    assert.equal(isPrivateIp(ip), true, `${ip} should be private`);
  }
});

test("isPrivateIp: routable public addresses are not private", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "203.0.113.5", "172.15.0.1", "172.32.0.1", "100.63.0.1", "100.128.0.1"]) {
    assert.equal(isPrivateIp(ip), false, `${ip} should be public`);
  }
});

test("isPrivateIp: IPv6 loopback/ULA/link-local/mapped are private, GUA is public", () => {
  for (const ip of ["::1", "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:10.0.0.1"]) {
    assert.equal(isPrivateIp(ip), true, `${ip} should be private`);
  }
  for (const ip of ["2606:4700:4700::1111", "2001:4860:4860::8888"]) {
    assert.equal(isPrivateIp(ip), false, `${ip} should be public`);
  }
});

test("isPrivateIp: non-IP input defaults to private (fail closed)", () => {
  assert.equal(isPrivateIp("not-an-ip"), true);
});

test("normalizeUrl: bare domain gets https and parses", () => {
  const u = normalizeUrl("example.com");
  assert.equal(u.protocol, "https:");
  assert.equal(u.hostname, "example.com");
});

test("normalizeUrl: existing scheme is preserved and input is trimmed", () => {
  const u = normalizeUrl("  http://example.com/path  ");
  assert.equal(u.protocol, "http:");
  assert.equal(u.hostname, "example.com");
  assert.equal(u.pathname, "/path");
});

test("normalizeUrl: rejects empty and dotless hostnames", () => {
  assert.throws(() => normalizeUrl(""));
  assert.throws(() => normalizeUrl("   "));
  assert.throws(() => normalizeUrl("localhost"));
});

test("robotsBlocks: empty or missing robots never blocks", () => {
  assert.equal(robotsBlocks("", "GPTBot"), false);
  assert.equal(robotsBlocks(null, "GPTBot"), false);
});

test("robotsBlocks: wildcard Disallow / blocks every agent", () => {
  const txt = "User-agent: *\nDisallow: /";
  assert.equal(robotsBlocks(txt, "GPTBot"), true);
  assert.equal(robotsBlocks(txt, "PerplexityBot"), true);
});

test("robotsBlocks: a named group only affects that agent", () => {
  const txt = "User-agent: GPTBot\nDisallow: /";
  assert.equal(robotsBlocks(txt, "GPTBot"), true);
  assert.equal(robotsBlocks(txt, "PerplexityBot"), false); // no * group to fall back to
});

test("robotsBlocks: a specific group takes precedence over the wildcard", () => {
  const txt = "User-agent: *\nDisallow: /\nUser-agent: GPTBot\nAllow: /";
  assert.equal(robotsBlocks(txt, "GPTBot"), false); // own group allows
  assert.equal(robotsBlocks(txt, "CCBot"), true); // falls to wildcard
});

test("robotsBlocks: partial-path disallow does not block the whole site", () => {
  assert.equal(robotsBlocks("User-agent: *\nDisallow: /private", "GPTBot"), false);
});

test("robotsBlocks: a root Allow offsets a root Disallow", () => {
  assert.equal(robotsBlocks("User-agent: *\nDisallow: /\nAllow: /", "GPTBot"), false);
});

test("robotsBlocks: case-insensitive and comment-tolerant", () => {
  assert.equal(robotsBlocks("user-agent: gptbot # note\ndisallow: /", "GPTBot"), true);
});

test("robotsBlocks: consecutive user-agents share one group", () => {
  const txt = "User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /";
  assert.equal(robotsBlocks(txt, "GPTBot"), true);
  assert.equal(robotsBlocks(txt, "CCBot"), true);
});

test("analyzeHtml: extracts title with collapsed whitespace", () => {
  assert.equal(analyzeHtml("<title>  Hello   World \n</title>").title, "Hello World");
});

test("analyzeHtml: reads meta description and counts Open Graph tags", () => {
  const html =
    '<meta name="description" content="A real description">' +
    '<meta property="og:title" content="x">' +
    '<meta property="og:image" content="y">';
  const o = analyzeHtml(html);
  assert.equal(o.description, "A real description");
  assert.equal(o.og, 2);
});

test("analyzeHtml: parses JSON-LD single object, @graph, array, and multi-type", () => {
  assert.deepEqual(analyzeHtml('<script type="application/ld+json">{"@type":"Organization"}</script>').jsonld, ["Organization"]);
  assert.deepEqual(
    analyzeHtml('<script type="application/ld+json">{"@graph":[{"@type":"Article"},{"@type":"Person"}]}</script>').jsonld,
    ["Article", "Person"],
  );
  assert.deepEqual(analyzeHtml('<script type="application/ld+json">[{"@type":"FAQPage"}]</script>').jsonld, ["FAQPage"]);
  assert.deepEqual(
    analyzeHtml('<script type="application/ld+json">{"@type":["Organization","LocalBusiness"]}</script>').jsonld,
    ["Organization/LocalBusiness"],
  );
});

test("analyzeHtml: malformed JSON-LD is recorded as unparseable, not thrown", () => {
  assert.deepEqual(analyzeHtml('<script type="application/ld+json">{bad json}</script>').jsonld, ["(unparseable)"]);
});

test("analyzeHtml: empty input yields empty analysis", () => {
  assert.deepEqual(analyzeHtml(""), { title: null, description: null, og: 0, jsonld: [] });
});

test("scoreChecks: all pass is 100, all fail is 0", () => {
  const pass = CHECK_WEIGHTS.map(() => ({ status: "pass" }));
  const fail = CHECK_WEIGHTS.map(() => ({ status: "fail" }));
  assert.equal(scoreChecks(pass), 100);
  assert.equal(scoreChecks(fail), 0);
});

test("scoreChecks: weighted mix rounds to the expected score", () => {
  // weights [35,22,15,8,15,5]; 35*1 + 22*.5 + 15*0 + 8*1 + 15*1 + 5*.5 = 71.5 -> 72
  const checks = ["pass", "warn", "fail", "pass", "pass", "warn"].map((status) => ({ status }));
  assert.equal(scoreChecks(checks), 72);
});

test("gradeFor: boundaries map to letters", () => {
  assert.equal(gradeFor(100), "A");
  assert.equal(gradeFor(90), "A");
  assert.equal(gradeFor(89), "B");
  assert.equal(gradeFor(75), "B");
  assert.equal(gradeFor(74), "C");
  assert.equal(gradeFor(60), "C");
  assert.equal(gradeFor(59), "D");
  assert.equal(gradeFor(40), "D");
  assert.equal(gradeFor(39), "F");
  assert.equal(gradeFor(0), "F");
});

test("AI_CRAWLERS: the tracked list is stable and well-formed", () => {
  assert.equal(AI_CRAWLERS.length, 7);
  for (const c of AI_CRAWLERS) {
    assert.equal(typeof c.ua, "string");
    assert.ok(c.ua.length > 0);
    assert.equal(typeof c.who, "string");
  }
  const uas = AI_CRAWLERS.map((c) => c.ua);
  assert.ok(uas.includes("GPTBot"));
  assert.ok(uas.includes("PerplexityBot"));
});
