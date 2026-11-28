# PRODUCT.md

Source: written 2026-11-28 from the approved brief (`prompt/`), the Phase 1 handoff and existing code. Josef approved writing it from the brief without an interview. Lines marked *(inferred)* are my reading, not his words.

## Platform

web

## Stack

Astro 7 (server output, strict TypeScript) on Cloudflare Workers, D1, R2, Cloudflare Access; Preact admin; Zod; GSAP only inside islands; Tiptap for the devlog editor. Fonts self-hosted via @fontsource (Archivo variable, Zen Kaku Gothic New).

## Users

1. University admissions readers (primary): skim fast, look for honest evidence of initiative and learning.
2. Internship recruiters: want proof of real work and usable links.
3. Curious teachers, professors and visitors.
Most first visits are on phones *(inferred from the mobile performance focus)*.

## Product Purpose

An honest public record of Josef Yang's engineering work and learning, started in October 2026: projects, failures, devlog, and who he is. Every text and image is editable in the admin.

## Positioning

A person, not a topic. Rare craft (physical workbench, real objects, bold type) instead of trending templates. Honest over impressive.

## Operating Context

Josef (17, Jakarta) edits alone through the admin, often from his phone. Content is sparse and grows over time, so every section must work with zero, one or many items.

## Capabilities and Constraints

- Every visible string and image comes from editable content; views never hard-code copy, colours or URLs.
- Never fabricate statuses, metrics, dates, progress or achievements. Unknown facts are omitted cleanly.
- Motion never traps scroll; reduced motion, touch and keyboard paths always exist.
- Cloudflare free tier; keep heavy code off routes that do not need it.
- Fuse stays a separate app. game.josefyang.com is the separate game catalog.

## Brand Commitments

- Repo tokens in `src/styles/tokens.css` are the approved palette: black, white, granite/desk paper grounds, one sun-orange accent (#F26B1D) used rarely. The older ink/paper/fire system was explicitly rejected for this site (decisions D17).
- Archivo display (heavy, tight), Zen Kaku Gothic New body. Sentence case. No all-caps eyebrows, mono micro-labels, arrows appended to links as decoration, gradient washes or metric counters.
- Tone: short, plain, first person. Buttons say exactly what happens.

## Evidence on Hand

- Chronos project pack: real screenshots (runway, quick-add, log-task, switch before/after, six themes) and a runway demo video.
- About portrait and story copy approved in the Phase 1 handoff.
- Learning threads: Harvard CS50P (Python) and ESP32 electronics, presented as learning, not credentials.

## Product Principles

1. Proof first: a project link or real screenshot in the first screen.
2. One idea per section, one main focus.
3. Honest empty states instead of filler.
4. Usable without JavaScript; motion is an enhancement.

## Accessibility & Inclusion

WCAG 2.1 AA contrast; 44px touch targets; visible focus; skip links land on real headings; reduced motion respected; no hover-only information.
