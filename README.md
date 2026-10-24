# PlanStudy — Waitlist Landing Page

[![CI](https://github.com/AeroQuant-Labs/Plan-Study-Waitlist/actions/workflows/ci.yml/badge.svg)](https://github.com/AeroQuant-Labs/Plan-Study-Waitlist/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/AeroQuant-Labs/Plan-Study-Waitlist)](https://github.com/AeroQuant-Labs/Plan-Study-Waitlist/releases)
[![Repo size](https://img.shields.io/badge/repo%20size-single%20file%20%E2%89%A43%20MB-blue)](index.html)

The waitlist landing page for **PlanStudy** — an AI study planner that turns a class timetable, deadlines and exams into a day-by-day plan students can actually finish.

**Everything is one file:** `index.html` holds all the CSS, JavaScript, images and the teaser video inline. There is no build step and no external asset — open the file in any browser, online or offline, and the full page works. CI enforces this (see below).

---

## What's on the page

- **Hero** — headline, waitlist form, and a hands-on phone demo that auto-cycles through the week (Mon–Fri) until a visitor clicks a day; the demo uses the six-subject pilot schedule (DCIT 101, MATH 121, UGRC 150, STAT 111, DCIT 103, MATH 123).
- **Product commercial** — the 53-second portrait commercial, re-encoded and inlined (no external video); muted, looping, no controls, it plays as soon as it is on screen in a centred phone-shaped player.
- **Problem → plan** — "Most students plan on scraps of paper" section and a four-step How-it-works.
- **Feature tour** — a timetable spotlight card (flagship, launching first) followed by the full feature set: AI day-by-day planning, PDF outline auto-fill, focus timer with breaks, streaks, weekly summaries, stats, deadline and exam radar, offline-first, cross-device, and free to use.
- **Timetable builder demo** — add a course code, name, time and colour; rows appear in the phone live.
- **Offline-first** — today's plan card with a progress bar that fills as you scroll to it.
- **FAQ** and a final waitlist CTA.
- **Motion system** — entrance choreography, scroll reveals, a reading-progress bar, and micro-interactions; every animation is disabled automatically for visitors with `prefers-reduced-motion` set.

## Configuring the waitlist endpoint

The form is wired to a single constant at the top of the inline script:

```js
const WAITLIST_ENDPOINT = ""; // e.g. "https://formspree.io/f/xxxxxxx"
```

- **Empty (default):** demo mode — sign-ups are stored in the visitor's `localStorage` only. CI prints a warning so nobody ships this by accident.
- **Set:** the form POSTs JSON to the endpoint:

```json
{ "email": "student@campus.edu", "source": "planstudy-waitlist" }
```

Any receiver that accepts that shape works (Formspree, a Google Apps Script web app, your own API).

## Repository layout

| Path | Purpose |
| --- | --- |
| `index.html` | The entire site — the only file that ships |
| `scripts/check.mjs` | Zero-dependency gatekeeper run by CI |
| `tests/e2e.mjs` | End-to-end suite that drives headless Chrome (`npm test`) |
| `package.json` | Test-harness scripts and devDependency (the site itself has none) |
| `.github/workflows/ci.yml` | Runs the gate on every push and pull request |
| `.github/workflows/deploy.yml` | Publishes `main` to GitHub Pages |

## Development workflow

Trunk-based with a long-lived integration branch:

```
feature/<short-name>  ──PR──▶  develop  ──PR──▶  main  (tagged releases, deployed)
```

1. `git switch develop && git pull`
2. `git switch -c feature/my-change`
3. Edit `index.html`; keep the gate green locally: `node scripts/check.mjs`
4. Push and open a PR into `develop` — CI must pass before merge
5. When the next cut is ready, PR `develop` → `main` and cut a release

## CI — the page contract

`.github/workflows/ci.yml` runs `scripts/check.mjs` on every push and PR. It fails the build if the page:

- grows past **3 MB**,
- gains **any external asset** (`src`, `srcset`, `poster`, `<link href>`, CSS `url()` or `@import` pointing at the network),
- loses a required piece: `<title>`, viewport, exactly one `<h1>`, the waitlist form, the `WAITLIST_ENDPOINT` hook, the reduced-motion support, or the video's `autoplay muted loop playsinline` attributes,
- drops below two inline images, or has unbalanced key tags.

It also **warns** (without failing) while `WAITLIST_ENDPOINT` is still empty.

Run it locally with any Node ≥ 18: `node scripts/check.mjs`.

## End-to-end tests

`tests/e2e.mjs` serves the page exactly like production (localhost HTTP) and drives **real headless Chrome** through every interactive component — 29 checks in total:

- hero entrance settles (word-by-word, full colour) and the ambient loops are actually running (marquee, FAB ripple, pill dot, stage glow)
- the phone demo auto-cycles the week, hands control over when a day is clicked, and repaints class rows
- both waitlist forms reject invalid emails and save valid sign-ups in demo mode
- the commercial autoplays muted + looped with no controls when it reaches the viewport
- every section reveals on scroll; the offline bar fills to 68%; the FAQ opens
- the builder adds courses via button **and** Enter, honours colour swatches, clears its inputs
- the reading-progress bar reaches full at the bottom and resets at the top
- true 390 px mobile: no sideways panning (verified with a real touch gesture), tab taps work, form usable
- reduced-motion visitors get animations off, no progress bar, a frozen day cycle, and content visible immediately
- zero JS/console errors and **zero external network requests** (offline-safe proof)

```bash
npm ci
npm test          # needs Chrome; override the binary with CHROME_PATH=/path/to/chrome
```

CI runs the suite as the `e2e` job on every push and pull request, next to the static `page-gate`.

## Deployment

The site publishes to **GitHub Pages** through GitHub Actions (`deploy.yml`), gated by the same page-contract checks as CI.

**Current status:** this repository is **private on the Free plan**, which cannot publish Pages. The deploy workflow therefore runs **on demand**: *Actions → Deploy to GitHub Pages → Run workflow*.

To go live:

1. Make the repository public (Settings → General → *Change visibility*), **or** upgrade the organisation plan.
2. Settings → Pages → Source: **GitHub Actions**.
3. Re-enable the automatic push trigger in `.github/workflows/deploy.yml` (see the comment at the top of the file).

The site will then be served at `https://aerquant-labs.github.io/Plan-Study-Waitlist/`.

## Releases

Versions follow [SemVer](https://semver.org), are tagged from `main`, and published as GitHub Releases:

| Tag | Meaning |
| --- | --- |
| `v1.0.x` | The landing page itself |
| `v1.1.x` | CI, Pages automation and docs |
| patch / minor / major | fix on the page / new content or behaviour / breaking restructure |

```bash
git switch main && git pull
git tag -a v1.2.0 -m "v1.2.0 - <what changed>"
git push origin v1.2.0
```

## Team

| Name | Role |
| --- | --- |
| Max | Product manager |
| Solomon | Frontend |
| Kuami Loh | Frontend |
| Benedicta | Backend & UI/UX |
| Henry | QA & release |

---

© 2026 AeroQuant Labs. PlanStudy — study smarter, plan better.
