# 05. Text and image slots

Approved 16 Nov 2026. Replaces architecture §5.4 and extends §10.

## 1. Text: size is fixed by role, length is managed

Goal: consistent sizes everywhere, and a longer title must never wrap onto extra lines and break a layout.

1. Every text field has a **role** (heading, subheading, body, label, button, pill) that fixes its size token. The admin has **no size picker**.
2. Every field has `maxLines` and a hard `max` character count set by its module (e.g. floor build name: 2 lines; hero headline: 2 lines; pill: 1 line, 22 chars; button: 1 line, 18 chars).
3. If the text exceeds `maxLines` at its role size, the renderer **steps it down by one, at most two, tokens** (e.g. xl → l → m). Do it in CSS: container query units + `clamp()` + `text-wrap: balance`, with a data attribute per step computed at render from character count and container width. No client JS.
4. If it still doesn't fit at the smallest allowed step: the admin **blocks publish** for that field, shows "Too long for this spot: N characters over. Shorten it." and the live preview highlights the overflow in orange.
5. Pills and buttons never wrap.
6. The admin's "Text on this page" panel shows each field's fit state: fits / shrunk 1 step / shrunk 2 steps / too long.

## 2. Image slots: fixed shape, three fit modes

Every slot has a fixed aspect ratio (per breakpoint), so adding or swapping an image never shifts the layout. Until an image exists, the slot shows the designed empty state.

| Mode | Behaviour | Use for |
|---|---|---|
| **Fill** (default) | Crop to the slot ratio around a focal point Josef clicks; optional zoom slider | Photos, screenshots |
| **Fit** | Whole image inside the slot on a neutral matte (`--tile` or the page ground) | Diagrams, odd-ratio screenshots |
| **Object** | Transparent cut-out, centred in a padding box, with the real shadow and the white hover outline following the shape | Featured builds on the floor, portrait |

No AI "expand". If an Object image has no transparency, fall back to a rounded tile with the same shadow and outline.

Stored as `{ mediaId, focal: {x, y}, zoom, mode, alt }`. Desktop and mobile crops come from the same focal point.

## 3. What each slot expects

Upload the largest original available. The admin generates AVIF + WebP at 480 / 960 / 1600 / 2400 px in the browser.

| Slot | Ratio | Min size | Format | Notes |
|---|---|---|---|---|
| Home hero portrait | arch, 11:12, Object | 1600 × 2000 | PNG/WebP, transparent | B&W applied by CSS; keep colour original |
| Featured build on the floor | 4:3, Object | 2000 × 1500 | PNG/WebP, transparent | ~10% empty margin around the object |
| Chronos / Fuse screenshots | 16:10, Fill or Fit | 2400 × 1500 | JPG/WebP/PNG | 100% browser zoom screenshots |
| Projects selector card | 16:9, Fill | 1920 × 1080 | JPG/WebP | Can reuse the build hero |
| Build page hero | 21:9 desktop, 16:9 mobile, Fill | 2400 × 1029 | JPG/WebP | |
| Build proof / gallery | 3:2 or 16:9, Fill or Fit | 1600 px long edge | JPG/WebP | Phone photos fine |
| Devlog photo | 4:5, Fill | 1080 × 1350 | JPG/WebP | Matches Instagram for the post pack |
| Devlog featured | 16:10, Fill | 2000 × 1250 | JPG/WebP | |
| About portrait | 4:5, Fill | 1600 × 2000 | JPG/WebP | |
| Failures tile | 1:1, Object or Fill | 1200 × 1200 | PNG/WebP | Greyscale by CSS |
| Social share (OG) | 1.91:1, Fill | 1200 × 630 | JPG | Default in Settings, optional per build |
| Icons | 1:1 | vector | SVG, single colour | One consistent outline set |

Limits: max 20 MB per upload; JPEG, PNG, WebP, AVIF, HEIC (verify browser decode). Below-minimum images upload with a warning ("Will look soft on large screens"). Alt text required before publish.

## 4. Cut-outs

Floor objects and the portrait look best transparent. Josef can use his phone's "lift subject", a free background remover, or ask Claude. Object mode degrades gracefully to a rounded tile while cut-outs are pending.
