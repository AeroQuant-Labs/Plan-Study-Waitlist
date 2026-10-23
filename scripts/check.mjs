#!/usr/bin/env node
/**
 * PlanStudy Waitlist — repository gatekeeper.
 *
 * The whole site is one HTML file. This script is the contract that keeps
 * it that way: it fails CI if the page loses what makes it special (fully
 * inline, small, accessible basics, motion safety) and warns when the
 * waitlist endpoint is still in demo mode.
 *
 * No dependencies — runs on any stock Node (>=18).
 */
import { readFileSync, statSync } from "node:fs";

const FILE = "index.html";
const MAX_MB = 3;
const errors = [];
const warnings = [];
const ok = (msg) => console.log(`  ok  ${msg}`);
const bad = (msg) => errors.push(msg);

let html = "";
try {
  html = readFileSync(FILE, "utf8");
} catch {
  console.error(`\n  FAIL ${FILE} not found — the site must stay a single root file.`);
  process.exit(1);
}

/* 1. Size budget ---------------------------------------------------------- */
const mb = statSync(FILE).size / (1024 * 1024);
if (mb > MAX_MB) bad(`${FILE} is ${mb.toFixed(2)} MB — keep it under ${MAX_MB} MB (compress images/video).`);
else ok(`size ${mb.toFixed(2)} MB (budget ${MAX_MB} MB)`);

/* 2. Fully self-contained ------------------------------------------------- */
// Ignore script/style bodies (they contain JS strings, not assets).
const stripped = html
  .replace(/<script[\s\S]*?<\/script>/gi, "<script></script>")
  .replace(/<style[\s\S]*?<\/style>/gi, "<style></style>");

const external = [
  // asset-bearing attributes on any tag
  ...[...stripped.matchAll(/\b(?:src|srcset|poster)\s*=\s*["'](\s*https?:\/\/[^"']+)["']/gi)].map((m) => m[1].trim()),
  // external stylesheets / preconnects
  ...[...stripped.matchAll(/<link[^>]+href\s*=\s*["'](https?:\/\/[^"']+)["']/gi)].map((m) => m[1]),
  // CSS asset references
  ...[...stripped.matchAll(/url\(\s*["']?(https?:\/\/[^)"']+)/gi)].map((m) => m[1]),
  ...[...stripped.matchAll(/@import\s+["'](https?:\/\/[^"']+)["']/gi)].map((m) => m[1]),
];
if (external.length) bad(`external asset(s) found — the page must work offline:\n         ${external.join("\n         ")}`);
else ok("fully self-contained (no external assets)");

/* 3. Required building blocks --------------------------------------------- */
const required = [
  ["title", () => /<title>[^<]{3,}<\/title>/i.test(html)],
  ["meta viewport", () => /<meta[^>]+name=["']viewport["']/i.test(html)],
  ["inline favicon (no /favicon.ico 404)", () => /<link[^>]+rel=["']icon["']\s+href=["']data:/i.test(html)],
  ["exactly one <h1>", () => (html.match(/<h1[\s>]/g) || []).length === 1],
  ["waitlist form (.wl-form)", () => /<form[^>]*class=["'][^"']*\bwl-form\b/i.test(html)],
  ["endpoint hook (WAITLIST_ENDPOINT)", () => /const\s+WAITLIST_ENDPOINT/.test(html)],
  ["prefers-reduced-motion support", () => /prefers-reduced-motion/.test(html)],
  [
    "teaser video (autoplay + muted + loop + playsinline)",
    () => {
      const tag = html.match(/<video[^>]*>/i)?.[0] || "";
      return ["autoplay", "muted", "loop", "playsinline"].every((a) => new RegExp(`\\b${a}\\b`, "i").test(tag));
    },
  ],
];
for (const [label, test] of required) (test() ? ok(label) : bad(`missing ${label}`));

const images = (stripped.match(/data:image\/[a-z0-9.+-]+;base64/gi) || []).length;
if (images < 2) bad(`expected the inline images (hero hands + bottom poster), found ${images}`);
else ok(`${images} inline images`);

/* 4. Tag balance (visible markup only) ------------------------------------- */
let balanced = true;
for (const tag of ["html", "head", "body", "main", "header", "footer", "section", "div", "form", "script", "style"]) {
  const open = (stripped.match(new RegExp(`<${tag}(?=[\\s>/])`, "gi")) || []).length;
  const close = (stripped.match(new RegExp(`</${tag}>`, "gi")) || []).length;
  if (open !== close) {
    balanced = false;
    bad(`unbalanced <${tag}>: ${open} open vs ${close} close`);
  }
}
if (balanced) ok("tag balance");

/* 5. Endpoint sanity ------------------------------------------------------- */
const ep = html.match(/const\s+WAITLIST_ENDPOINT\s*=\s*["']([^"']*)["']/);
if (ep && ep[1] === "") warnings.push("WAITLIST_ENDPOINT is empty — sign-ups stay in localStorage (demo mode).");
else if (ep) ok("waitlist endpoint configured");

/* Verdict ------------------------------------------------------------------ */
for (const w of warnings) console.log(` warn ${w}`);
if (errors.length) {
  console.error("\n  FAIL checks did not pass:");
  for (const e of errors) console.error(`    - ${e}`);
  process.exit(1);
}
console.log("\n  All checks passed.");
