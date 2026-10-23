/**
 * End-to-end verification for the PlanStudy waitlist page.
 * Serves the REPO copy of index.html over localhost (production-like) and
 * drives real Chrome through every interactive component.
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME =
  process.env.CHROME_PATH ||
  (process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "/usr/bin/google-chrome");
const results = [];
const jsErrors = [];
const external = new Set();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

/* ---- production-like static server ---- */
const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];
  if (url === "/" || url === "/index.html") {
    const html = await readFile(path.join(ROOT, "index.html"));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,900"],
});

function wire(page, tag) {
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith("about:")) external.add(u);
  });
  page.on("pageerror", (e) => jsErrors.push(`${tag} pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") jsErrors.push(`${tag} console.error: ${m.text()}`); });
}

/* ================= desktop journey ================= */
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
wire(page, "desktop");
await page.goto(BASE, { waitUntil: "load", timeout: 60000 });

// 1. hero entrance settles
await sleep(1500);
const hero = await page.evaluate(() => ({
  h1: getComputedStyle(document.querySelector(".hero h1")).opacity,
  tabs: document.querySelectorAll("#heroTabs .tab").length,
  pill: getComputedStyle(document.querySelector(".hero .pill")).opacity,
}));
check("hero entrance choreography settles", hero.h1 === "1" && hero.pill === "1" && hero.tabs === 5,
  `h1 ${hero.h1}, pill ${hero.pill}, tabs ${hero.tabs}`);

// 2. ambient motion running
const anim = await page.evaluate(() => {
  const track = document.querySelector(".strip .track");
  const g = (el, pseudo) => getComputedStyle(el, pseudo || null);
  return {
    marquee: track ? g(track).animationName + "/" + g(track).animationPlayState : "missing",
    fab: g(document.querySelector(".fab"), "::before").animationName,
    dot: g(document.querySelector(".hero .pill"), "::before").animationName,
    words: g(document.querySelector(".hero h1 .wi")).animationName,
    glow: g(document.querySelector(".stage"), "::before").animationName,
  };
});
check("ambient loops alive (marquee, fab ripple, pill dot, headline words, stage glow)",
  anim.marquee !== "none" && anim.marquee.includes("running") &&
  anim.fab === "ripple" && anim.dot === "blip" &&
  anim.words === "wordUp" && anim.glow === "glow",
  JSON.stringify(anim));

// 3. (image decode is checked after the reveal sweep below — the .oldway
//    photo is loading="lazy" and only decodes once it nears the viewport)

// 4. auto-cycle advances, then user takeover freezes it
const day = () => page.evaluate(() => document.querySelector('#heroTabs .tab[aria-selected="true"]')?.dataset.d || null);
const d0 = await day();
await sleep(4200);
const d1 = await day();
check("phone demo auto-cycles the week", d0 && d1 && d1 !== d0, `${d0} → ${d1}`);

await page.click('#heroTabs .tab[data-d="Fri"]');
const df0 = await day();
await sleep(7500); // > two full cycle intervals
const df1 = await day();
const rows = await page.$$eval("#heroList .cls", (e) => e.length);
check("clicking a day hands over control (cycle stops)", df0 === "Fri" && df1 === "Fri", `${df0} → ${df1}`);
check("day switch paints class rows", rows > 0, `${rows} rows on Fri`);

// 5. hero waitlist form: reject then save
await page.type(".hero .wl-form input", "not-an-email");
await page.click(".hero .wl-form button");
let m = await page.evaluate(() => {
  const s = document.querySelector(".hero .wl-form").nextElementSibling;
  return { cls: s.className, txt: s.textContent };
});
check("hero form rejects invalid email", m.cls.includes("err") && /valid email/i.test(m.txt), m.txt);

await page.$eval(".hero .wl-form input", (el) => (el.value = ""));
await page.type(".hero .wl-form input", "kofi@campus.edu");
await page.click(".hero .wl-form button");
await page.waitForFunction(
  () => document.querySelector(".hero .wl-form").nextElementSibling.classList.contains("ok"),
  { timeout: 4000 }
).catch(() => {});
m = await page.evaluate(() => {
  const s = document.querySelector(".hero .wl-form").nextElementSibling;
  return { cls: s.className, txt: s.textContent, ls: JSON.parse(localStorage.getItem("planstudy_waitlist") || "[]") };
});
check("hero form saves signup (demo mode)", m.cls.includes("ok") && m.ls.includes("kofi@campus.edu"),
  `${m.txt} | localStorage=${JSON.stringify(m.ls)}`);

// deterministic scrolling from here on
await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });

// 6. reveal sweep: walk the page so every section intersects
const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
for (let y = 0; y <= total; y += 450) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await sleep(140);
}
await sleep(500);
const unrev = await page.evaluate(() => document.querySelectorAll(".reveal:not(.in)").length);
check("every section reveals on scroll", unrev === 0, `${unrev} still hidden`);

// images decode (now that the lazy .oldway photo has been near the viewport)
const imgs = await page.evaluate(() => ({
  total: document.images.length,
  ok: [...document.images].every((i) => i.complete && i.naturalWidth > 0),
  hands: document.querySelector(".stage .hands")?.naturalWidth || 0,
}));
check("all inline images decode", imgs.ok && imgs.total >= 2 && imgs.hands > 0,
  `${imgs.total} imgs, hands ${imgs.hands}px`);

// 7. teaser video autoplays when it reaches the viewport
await page.evaluate(() => document.getElementById("player").scrollIntoView({ block: "center" }));
await sleep(3000);
const vid = await page.evaluate(() => {
  const v = document.getElementById("teaserVid");
  return { ready: v.readyState, paused: v.paused, t: v.currentTime, loop: v.loop, muted: v.muted, controls: v.controls };
});
check("teaser video loads and autoplays muted+looped, no controls",
  vid.ready >= 2 && !vid.paused && vid.t > 0 && vid.loop && vid.muted && !vid.controls,
  `readyState ${vid.ready}, paused ${vid.paused}, t=${vid.t.toFixed(2)}s`);

// 8. offline sync bar fills to 68%
await page.evaluate(() => document.querySelector(".offline").scrollIntoView({ block: "center" }));
await sleep(2800);
const bar = await page.evaluate(() => {
  const b = document.querySelector(".offline .bar");
  const s = b.querySelector("span");
  return s.getBoundingClientRect().width / b.getBoundingClientRect().width;
});
check("offline progress bar fills", bar > 0.65 && bar < 0.71, `${(bar * 100).toFixed(1)}%`);

// 9. FAQ opens
await page.evaluate(() => document.querySelector(".faq details").scrollIntoView({ block: "center" }));
await sleep(300);
await page.click(".faq details:first-child summary");
await sleep(700);
const faq = await page.evaluate(() => {
  const d = document.querySelector(".faq details");
  const p = d.querySelector("p");
  return { open: d.hasAttribute("open"), opacity: getComputedStyle(p).opacity, h: p.getBoundingClientRect().height };
});
check("FAQ row opens with answer visible", faq.open && faq.opacity === "1" && faq.h > 0,
  `open=${faq.open}, opacity ${faq.opacity}`);

// 10. builder: colour swatch + add via button, then Enter
await page.evaluate(() => document.querySelector(".builder").scrollIntoView({ block: "center" }));
await sleep(300);
const swatches = await page.$$("#bSw button");
await swatches[2].click();
await page.type("#bCode", "dcit205");
await page.type("#bName", "Data Structures");
await page.type("#bTime", "11:30");
await page.click("#bAdd");
let b = await page.evaluate(() => ({
  rows: [...document.querySelectorAll("#buildList .cls")].map((r) => r.textContent),
  pressed: [...document.querySelectorAll("#bSw button")].map((x) => x.getAttribute("aria-pressed")),
  code: document.getElementById("bCode").value,
  name: document.getElementById("bName").value,
}));
check("builder adds a course row (button)", b.rows.some((t) => t.includes("DCIT205") && t.includes("Data Structures")),
  `${b.rows.length} rows; new row present=${b.rows.some((t) => t.includes("DCIT205"))}`);
check("builder colour swatch selects", b.pressed.filter((x) => x === "true").length === 1 && b.pressed[2] === "true",
  JSON.stringify(b.pressed));
check("builder clears inputs after add", b.code === "" && b.name === "", `code='${b.code}'`);

await page.type("#bCode", "math205");
await page.type("#bName", "Linear Algebra");
await page.keyboard.press("Enter");
b = await page.evaluate(() => [...document.querySelectorAll("#buildList .cls")].map((r) => r.textContent));
check("builder adds a course row (Enter key)", b.some((t) => t.includes("MATH205") && t.includes("Linear Algebra")),
  `${b.length} rows`);

// 11. reading progress: bottom then back to top
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await sleep(600);
const scaleX = () => page.evaluate(() => {
  const t = getComputedStyle(document.querySelector(".progress i")).transform;
  if (t === "none") return null;
  return parseFloat(t.slice(t.indexOf("(") + 1));
});
const atBottom = await scaleX();
check("progress bar reaches full at page bottom", atBottom !== null && atBottom > 0.94, `scaleX=${atBottom}`);

await page.evaluate(() => window.scrollTo(0, 0));
await sleep(600);
const atTop = await scaleX();
check("progress bar resets at page top", atTop !== null && atTop < 0.06, `scaleX=${atTop}`);

// 12. CTA waitlist form (second .wl-form)
await page.evaluate(() => document.querySelector(".cta .wl-form").scrollIntoView({ block: "center" }));
await sleep(400);
await page.type(".cta .wl-form input", "ama@campus.edu");
await page.click(".cta .wl-form button");
await page.waitForFunction(
  () => document.querySelectorAll(".cta .wl-form")[0].nextElementSibling.classList.contains("ok"),
  { timeout: 4000 }
).catch(() => {});
const cta = await page.evaluate(() => {
  const s = document.querySelector(".cta .wl-form").nextElementSibling;
  return { cls: s.className, ls: JSON.parse(localStorage.getItem("planstudy_waitlist") || "[]") };
});
check("CTA form saves signup too", cta.cls.includes("ok") && cta.ls.length === 2,
  `localStorage=${JSON.stringify(cta.ls)}`);

/* ================= mobile (true 390px layout) ================= */
const mob = await browser.newPage();
await mob.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
wire(mob, "mobile");
await mob.goto(BASE, { waitUntil: "load", timeout: 60000 });
await sleep(1200);
const vw = await mob.evaluate(() => ({ iw: innerWidth, sw: document.documentElement.scrollWidth }));
check("mobile 390px: viewport is really 390", vw.iw === 390, `innerWidth ${vw.iw} (content spills to ${vw.sw}, must be clipped)`);
// real user gesture: a horizontal finger swipe must not pan the page
// (programmatic scrollTo bypasses the user-input restriction, so it lies)
await mob.touchscreen.touchStart(330, 500);
for (let x = 310; x >= 40; x -= 30) { await mob.touchscreen.touchMove(x, 500); await sleep(25); }
await mob.touchscreen.touchEnd();
await sleep(500);
const scrollX = await mob.evaluate(() => window.scrollX);
check("mobile 390px: touch swipe cannot pan sideways", scrollX === 0, `scrollX=${scrollX} after real swipe`);
await mob.evaluate(() => window.scrollTo(0, 0));
await mob.evaluate(() => document.documentElement.style.scrollBehavior = "auto");
await mob.screenshot({ path: path.join(os.tmpdir(), "planstudy-e2e-mob390.png") });
await mob.tap('#heroTabs .tab[data-d="Mon"]').catch(async () => { await mob.click('#heroTabs .tab[data-d="Mon"]'); });
await sleep(300);
const mobState = await mob.evaluate(() => ({
  day: document.querySelector('#heroTabs .tab[aria-selected="true"]')?.dataset.d,
  rows: document.querySelectorAll("#heroList .cls").length,
  form: (() => { const r = document.querySelector(".hero .wl-form").getBoundingClientRect(); return r.width > 100 && r.height > 0; })(),
}));
check("mobile: tab tap switches day", mobState.day === "Mon" && mobState.rows > 0,
  `day ${mobState.day}, ${mobState.rows} rows`);
check("mobile: waitlist form usable", mobState.form);

/* ================= reduced motion ================= */
const rm = await browser.newPage();
await rm.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
wire(rm, "reduced");
await rm.goto(BASE, { waitUntil: "load", timeout: 60000 });
await sleep(500);
const r1 = await rm.evaluate(() => ({
  h1anim: getComputedStyle(document.querySelector(".hero h1 .wi")).animationName,
  progress: getComputedStyle(document.querySelector(".progress")).display,
  day: document.querySelector('#heroTabs .tab[aria-selected="true"]')?.dataset.d,
  revealOp: getComputedStyle(document.querySelector(".reveal")).opacity,
}));
await sleep(3900);
const r2day = await rm.evaluate(() => document.querySelector('#heroTabs .tab[aria-selected="true"]')?.dataset.d);
check("reduced-motion: entrance animations off", r1.h1anim === "none", `h1 words animation=${r1.h1anim}`);
check("reduced-motion: progress bar hidden", r1.progress === "none");
check("reduced-motion: content visible immediately", r1.revealOp === "1", `reveal opacity ${r1.revealOp}`);
check("reduced-motion: day auto-cycle frozen", r1.day === r2day, `${r1.day} → ${r2day}`);

/* ================= cross-cutting ================= */
check("no JS/console errors on any page", jsErrors.length === 0, jsErrors.slice(0, 5).join(" | "));
check("zero external network requests (offline-safe)", external.size === 0, [...external].join(", "));

/* ================= verdict ================= */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("FAILURES:");
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
}
await browser.close();
server.close();
process.exit(failed.length ? 1 : 0);
