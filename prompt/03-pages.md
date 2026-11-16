# 03. Pages (approved)

Routes: `/` Home, `/projects`, `/builds/[slug]`, `/failures`, `/devlog`, `/devlog/[slug]`, `/about`. Every page uses the floating pill nav at the top and the black footer at the bottom. Every section below is its own module (see `04-architecture.md` §5). Mockups in `designs/`.

---

## Home `/`  (designs/02-home-desktop.html, designs/01-home-floor-map.html)

The wow moment is the start journey across 4–5 featured builds. It must work flawlessly.

1. **Hero on the granite floor**
   - Floating pill nav.
   - Centred headline (giant, 2 lines): "Josef Yang builds hardware and software".
   - Line: "Student engineer. Jakarta. Building since October 2026."
   - Two social pills: Instagram, GitHub.
   - Black-and-white portrait cut-out, centred, rising from the bottom of the section (arched top). Colour original stored; B&W via CSS filter.
   - Floor details: a top-down cappuccino (left), a phone playing jazz (right, tilted). Real shadows.

2. **The floor (featured builds)**: one stage of the same granite room.
   - Featured builds (4–5, set in admin with `featured` + `home_order`) are **scattered across a large 2D floor**, not in a line. Each scroll step pans the camera to the next build **in whatever direction it lies** (right, down-left, up-right…), with a soft whoosh. "A to B is a pan across the room, not a scroll down."
   - Full-screen is preferred but not required: Josef said "whatever works". Choose the most robust implementation. It must never break, jump, trap the user or misformat at any viewport size.
   - At each stop: the build object (cut-out image) on the left with a real shadow; on the right: kind (Hardware/Software), name (display), 2-sentence summary, skill pills, **View project** button. Neighbouring builds peek in at the edges, cropped, in their scattered positions. A watch or other small object can lie on the floor between stops.
   - Hover/focus on the object: white outline + lift. Click: go to `/builds/[slug]`.
   - Bottom-left: **counter** "2 / 4" (current / total). Bottom-right: "Skip to the rest" link.
   - Floor positions come from data (admin sets order; positions can be auto-generated scatter with a seed, plus an optional per-build nudge). Mobile: plain vertical list of the same build cards (no pan) unless you can make a pan feel native on touch.
   - Recommended implementation: a sticky viewport (`position: sticky; height: 100svh`) inside a tall scroll container; scroll progress maps to stop index; GSAP tweens the floor transform between precomputed stop coordinates; snap to stops; keyboard arrows/PageDown move between stops; leaving the last stop releases the scroll. Test trackpad, wheel, touch, keyboard and browser zoom.

3. **"A bit about me, off the record"** (white): about Josef as a person, not accolades. 3×2 grid of icon + heading + 2 lines:
   - I learn by breaking things. / I build my own systems. / I like problems I can predict. / Jazz on, after dark. / Kopi first. / Watches, and the pitch.
   - Copy is in the mockup; all editable.

4. **"I run my life on tools I built"** (soft grey `--section`): "Both are in daily use. Both are open to look at."
   - **Chronos** block: screenshot (16:10) left; name, headline "My day, planned to the block", text, stat row (Windows desktop · Phone app coming soon), **View project**.
   - **Fuse** block (mirrored): headline "My engineering diary, unfiltered", text, stat row (Desktop, laptop and phone · fuse.josefyang.com), **Open Fuse** (external).

5. **"From the devlog"** (white): heading + line "The polished version of Fuse. New entries twice a month." + **View the devlog** button (always present). A horizontally scrollable row of the latest **5** entries as photo cards (4:5 photo, date + build, title). Drag/scroll/keyboard accessible, with scroll snapping.

6. **Footer** (black, see design system).

Home button budget: View project (per floor stop and Chronos), Open Fuse, View the devlog, See the projects, About me. Nothing else is a button.

---

## Projects `/projects`  (designs/03-projects-desktop.html, 03-projects-mobile.html)

Ground: black with a soft white desk-lamp glow (radial light pool, no colour cast). Gimmick: **character select**.

- Top: "Pick a build" + line "On the bench now: [build]. Read the devlog".
- Sideways selector: one build centred and lit (16:9 real image), neighbours dimmed and scaled down on both sides. Scroll, arrow keys or swipe move sideways.
- Under the centred build: name (giant condensed), one-line summary, kind + year, prev/next icon buttons, **Open this build** primary button, hint "Scroll or use the arrow keys to browse. Enter opens. 2 of 8".
- All builds appear, including **failed builds, marked with a "Failed" pill**.
- Lock-in: Enter, Space or the button locks the choice and auto-scrolls down into that build's full page content (or navigates to `/builds/[slug]` with a matching transition, whichever is more robust; the URL must reflect the build so it can be shared). At the bottom: **Back to the selector**, which returns to the selector at the same build. Manual scrolling must always work too. One state machine; no scroll traps.
- Mobile: swipe snap carousel; tap opens.

## Build page `/builds/[slug]`

White. Title (giant), key facts row (Type, Built, Made with, Links), hero image (21:9 or 16:9), then four rows: **The question / The build / The proof / What changed** (heading left, content right). Proof shows screenshots, photos, video, code links. If status = failed: also **What broke / What I learned**. Ends with "Back to the selector" / next build, then the footer. Sections come from the build's template (see architecture §12.6).

---

## About `/about`  (designs/04-about-desktop.html, 04-about-mobile.html)

Ground: sun orange, with a black band and a white band. Focus on Josef as a person.

1. "About" (giant) + bio paragraph + portrait (4:5).
2. Black band: **"I started building in October 2026."** + honest paragraph (Scratch as a kid; real building since October 2026; the site is a public record of learning from close to zero; likes problems big enough to predict with physics; aiming for engineering abroad).
3. **The print rig** (gimmick): a rod-and-clamp rig printing a figure of Josef; one printed layer per milestone (from the `milestones` table, sorted by date). Few layers so far; most of the figure is still a dashed outline. Heading "Still printing". Milestones list beside it: Middle school, full games in Scratch / IGCSE, A* in Maths and English / October 2026, started building.
4. **Off the bench** (white): Jazz, Coffee, Watches, Football with icons and one line each.
5. "The short version": **Download CV (PDF)** + email.
6. **Find me**: Instagram + GitHub as large primary buttons; YouTube + LinkedIn as secondary outline buttons; note "YouTube is rougher: raw build footage, talked over."
7. Footer.

## Failures `/failures`  (designs/05-failures-desktop.html, 05-failures-mobile.html)

Ground: granite with the finer, smoother grain. Gimmick: **the hopper**.

- "Things that broke" (giant) + "Feed a failed build into the hopper. It prints what went wrong and what I took from it."
- Failed builds as white tiles (greyscale images, slight rotations) scattered around a black hopper with an orange rim. Drag a tile into the hopper, or focus it and press **Feed it in** (keyboard/tap path).
- The hopper prints a paper slip; below, the panel shows: build name, "Hardware, abandoned [month year]", **What broke**, **What it taught me**, link "See where the lesson went".
- "Every failure": full typographic list (name, kind, date).
- Optional easter egg: a cassette-style hopper sound/visual on feed. Keep it subtle.

## Devlog `/devlog` and `/devlog/[slug]`  (designs/06-devlog-desktop.html)

The polished, larger-scale version of Fuse. White.

- Giant "Devlog" + "What I built, what broke, what I'd change. Written up twice a month from my notes."
- Card: "Want the raw version?" → link to fuse.josefyang.com.
- Featured latest entry (16:10 photo, "Latest, [date]", title, excerpt, build tag, read time).
- Filter chips by build (All, Chronos, Fuse, Greenmech, …, Failures). Accessible `aria-pressed` toggles.
- Entries grouped by month with a **giant month numeral** column (sticky): "11 · November 2026", "10 · October 2026 · The month I started building". 3-column cards: photo 4:5, build tag + date, title, summary, **"Rough notes on Fuse"** link (this pairing of polished entry + raw note is the signature flair). Failure entries get a black "Failed" tag.
- Entry page `/devlog/[slug]`: title, date, build tag, hero photo, body (plain paragraphs + images), link to the Fuse note and to the build page, previous/next entry.
- Design a mobile version (not mocked yet).

## Mobile (all pages)

390px frames exist for Projects, About, Failures. Home mobile and Devlog mobile must be designed from the desktop versions (the Home mobile file is outdated). Rules: single column, 20px padding, menu button opens a full-screen nav, touch targets ≥ 44px, no hover-dependent information, floor pan becomes a vertical list unless proven smooth on touch.
