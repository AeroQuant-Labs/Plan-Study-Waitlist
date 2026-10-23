# PlanStudy — Waitlist Landing Page

[![CI](https://github.com/AeroQuant-Labs/Plan-Study-Waitlist/actions/workflows/ci.yml/badge.svg)](https://github.com/AeroQuant-Labs/Plan-Study-Waitlist/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/AeroQuant-Labs/Plan-Study-Waitlist)](https://github.com/AeroQuant-Labs/Plan-Study-Waitlist/releases)
[![Repo size](https://img.shields.io/badge/repo%20size-single%20file%20%E2%89%A43%20MB-blue)](index.html)

The waitlist landing page for **PlanStudy** — an AI study planner that turns a class timetable, deadlines and exams into a day-by-day plan students can actually finish.

**Everything is one file:** `index.html` holds all the CSS, JavaScript, images and the teaser video inline. There is no build step and no external asset — open the file in any browser, online or offline, and the full page works. CI enforces this (see below).

---

## What's on the page

- **Hero** — headline, waitlist form, and a hands-on phone demo that auto-cycles through the week (Mon–Fri) until a visitor clicks a day; the demo uses the six-subject pilot schedule (DCIT 101, MATH 121, UGRC 150, STAT 111, DCIT 103, MATH 123).
- **Teaser video** — muted, looping, no controls; it plays inline as soon as it is on screen.
- **Problem → plan** — "Most students plan on scraps of paper" section and a four-step How-it-works.
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

## Deployment

Pushes to `main` run the gate, then publish to **GitHub Pages** through GitHub Actions (`deploy.yml`). A manual run is available via *Actions → Deploy to GitHub Pages → Run workflow*.

> The repository must allow Pages deployments (Settings → Pages → Source: *GitHub Actions*).

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
