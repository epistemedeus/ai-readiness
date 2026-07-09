// Type declarations for ai-readiness (hand-authored to match lib.js).

/** Result status for a single readiness check. */
export type CheckStatus = "pass" | "warn" | "fail";

/** Overall letter grade derived from the weighted score. */
export type Grade = "A" | "B" | "C" | "D" | "F";

/** One AI crawler the checker tests robots.txt access for. */
export interface Crawler {
  /** The robots.txt user-agent token, e.g. "GPTBot". */
  ua: string;
  /** Human-readable note on what the crawler feeds. */
  who: string;
}

/** A single scored check in a readiness report. */
export interface Check {
  label: string;
  status: CheckStatus;
  detail: string;
  /** A concrete remediation, or null when the check passes. */
  fix: string | null;
}

/** The full result of {@link run}. */
export interface Report {
  /** The final URL after redirects. */
  url: string;
  /** Weighted score, 0-100. */
  score: number;
  grade: Grade;
  /** The six checks, in canonical order. */
  checks: Check[];
}

/** Parsed signals from a page's HTML, returned by {@link analyzeHtml}. */
export interface HtmlAnalysis {
  title: string | null;
  description: string | null;
  /** Count of Open Graph (`og:`) meta tags. */
  og: number;
  /** JSON-LD `@type` values found; "(unparseable)" for malformed blocks. */
  jsonld: string[];
}

/** The starter fixes returned by {@link generateFix}. */
export interface FixResult {
  url: string;
  host: string;
  name: string;
  organizationJsonLd: Record<string, unknown>;
  faqJsonLd: Record<string, unknown>;
  robotsTxt: string;
}

/** The AI crawlers whose robots.txt access is checked. */
export const AI_CRAWLERS: Crawler[];

/** Per-check weights, in the order {@link run} produces the checks. */
export const CHECK_WEIGHTS: number[];

/** True if the address is private, loopback, link-local, or CGNAT. */
export function isPrivateIp(ip: string): boolean;

/** Normalize a bare domain or URL to a URL; throws if invalid. */
export function normalizeUrl(raw: string): URL;

/** True if robots.txt blocks the given user-agent from the whole site. */
export function robotsBlocks(txt: string | null | undefined, uaName: string): boolean;

/** Extract title, meta description, Open Graph count, and JSON-LD types from HTML. */
export function analyzeHtml(html: string | null | undefined): HtmlAnalysis;

/** Weighted score (0-100) for an ordered array of checks. */
export function scoreChecks(checks: Check[], weights?: number[]): number;

/** Letter grade for a 0-100 score. */
export function gradeFor(score: number): Grade;

/** Fetch a site and score its AI-search readiness. */
export function run(rawUrl: string, asJson?: boolean): Promise<Report>;

/** Generate starter Organization + FAQPage JSON-LD and an AI-friendly robots.txt. */
export function generateFix(rawUrl: string): Promise<FixResult>;
