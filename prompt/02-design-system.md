# 02. Design system

Approved 16 Nov 2026. Encode all of this as tokens in `src/styles/tokens.css`. Modules use tokens only, never raw values.

## Look in one line

Bold Swiss type and real, physical depth on calm grounds: a matte granite floor you move across, white pages with generous space, black for the end of every page, and one sun-orange accent used sparingly.

## Colour

| Token | Hex | Use |
|---|---|---|
| `--white` | #FFFFFF | Main page ground (Home lower sections, Devlog, build pages) |
| `--granite` | #F1F1EF | Floor ground: Home hero + featured floor, Failures. Always with the grain texture |
| `--black` | #000000 | Text, footer, Projects ground, primary buttons. True black, never #111 |
| `--sun` | #F26B1D | The only accent. About page ground; small marks (logo square, active dots, seconds hand, link underline colour). Keep it rare elsewhere |
| `--section` | #F6F6F4 | Soft alternate section ground ("I run my life on tools I built") |
| `--tile` | #F4F4F2 | Empty-image state tile |
| `--hairline` | #E6E6E3 | Dividers, card borders |
| `--muted` | #4A4A47 | Secondary body text on white |
| `--muted-dark` | #B8B8B4 | Secondary text on black |

Check contrast for every pairing (≥4.5:1 body, ≥3:1 large). Black text on sun orange passes; white text on sun orange does not, so never use it.

### Granite texture

A matte, fine grain over `--granite`: SVG `feTurbulence` (fractalNoise, baseFrequency ≈ 0.85, 3 octaves) mapped to black at ~10% alpha, rendered once as a fixed-size tile (or a pre-rendered tiny PNG/WebP tile) and repeated. Failures uses a smoother, finer version (~0.6 frequency, ~5% alpha). Prefer a pre-rendered tile in production for performance; keep it subtle enough that text on it stays crisp.

## Page grounds

| Page | Ground | Gimmick (one per page) |
|---|---|---|
| Home | Granite (hero + floor), then white | The floor: camera pans across scattered builds |
| Projects | Black with a soft white desk-lamp glow | Character select |
| About | Sun orange (+ black and white bands) | The print rig |
| Failures | Granite (finer grain) | The hopper |
| Devlog | White | Month-grouped entries linked to their rough Fuse notes |
| Every page | Ends in the black footer | |

## Typography

- **Display and UI: Archivo** (variable, width 62–125, weight 400–900). Headings 800–900, tight tracking (−0.02 to −0.035em), line-height 0.85–1.0. Condensed widths (62–72%) for giant words (page titles, month numerals).
- **Body: Zen Kaku Gothic New** 400/500, 16–21px, line-height 1.6–1.75, measure ≤ 70ch.
- Self-host both, subset, `font-display: swap`, preload the display weight.
- Type scale tokens (role-based, see `05-text-and-image-spec.md`): `xs, s, m, l, xl, xxl` plus `giant` for page titles and the footer email. Use `clamp()` for fluid sizes.
- Sentence case. No all-caps labels. No mono "techy" labels.

## Spacing and grid

- Container max 1280px, 40px side padding (20px mobile).
- 12-column grid; the same grid on every page.
- Section rhythm: 120–140px vertical on desktop, 48–72px on mobile. More space above headings than below.

## Components (build each as a reusable piece)

- **Floating pill nav**: white pill, soft shadow, centred at top: Josef Yang (orange square mark) · Projects · Failures · Devlog · About · Get in touch. Mobile: logo + menu button (44px target).
- **Buttons**: pill shape. Primary = black fill, white text. Secondary = outline. On black: white fill or white outline. Height 52–64px. Max ~4 buttons on Home; never spam them.
- **Social pills**: white pill with outline icon + label (Instagram, GitHub).
- **Skill pills**: small outlined pills for skills learnt/used. Single line, never wrap.
- **Object card (featured build on the floor)**: the image sits on the floor with a real two-layer shadow (tight contact + soft long drop). **Hover = 8px white outline around the object + lift (translateY −10px) + deeper shadow.** Pure CSS. Clicking opens the project page. With transparent cut-outs the outline follows the object shape (CSS `drop-shadow` stack); otherwise it outlines the rounded tile.
- **Stat row**: outline icon (36px) + two-line label. Used in the Chronos/Fuse blocks.
- **Devlog card**: 4:5 photo, build tag pill + date, title, one-line summary, "Rough notes on Fuse" link.
- **Footer** (every page): black; "Building something? Let's talk." then the email `josef@josefyang.com` at giant size (clamp 56–128px) as a mailto link; "See the projects" + "About me" buttons; a 4-column link menu (Pages: Home, Projects, Failures, Devlog, About · My tools: Fuse, Chronos · Elsewhere: Instagram, GitHub, YouTube, LinkedIn · More: Download CV, How this site is built); bottom line "© 2026 Josef Yang, Jakarta" and "Built after dark, with jazz on and too much kopi." The page ends in black: no white strip after the footer.
- **Empty image state**: `--tile` rounded rectangle, outline image icon, short label ("Build image, added later"). Fixed aspect ratio so swapping never shifts layout.
- **Icons**: one consistent outline set (2–2.5px stroke, square-ish geometry). Draw them as SVG or use one library consistently. Never emoji.
- **Floor objects (easter eggs)**: top-down cappuccino with latte art, a phone showing a "Now playing" jazz card, a wristwatch (can show the real time), all with real shadows. Small, few, never cluttering.
- **Logo mark**: a small orange square beside "Josef Yang" until the JY monogram is redesigned. Do not draw a JY monogram yourself.

## Motion

GSAP (+ ScrollTrigger) only in islands that need it. Easing: strong ease-out (`expo.out` / cubic-bezier(0.16, 1, 0.3, 1)). No bounce, no glow, no pulsing CTAs, no fade-up on every section.

| Moment | Trigger | Behaviour | Reduced motion |
|---|---|---|---|
| Home floor pan | Scroll / arrow keys within the floor stage | Camera pans to the next scattered build in whatever direction it lies, ~700–900ms, soft whoosh feel (slight motion blur or scale 0.98→1 on arrival) | Builds stacked vertically, no pan |
| Object hover | Pointer hover / keyboard focus | White outline + lift, 220ms | Outline only |
| Projects selector | Scroll / arrows / swipe | Builds slide sideways; Enter/Space/button locks in and auto-scrolls into the build page | Plain list/grid |
| About print rig | Scroll | One layer prints per milestone | Shows the current print state |
| Failures hopper | Drag a tile in / "Feed it in" / tap | Tile drops into hopper; slip prints | List with expandable slips |
| Page transitions | ClientRouter navigation | Short crossfade or exit animation, then navigate | 150ms crossfade |

## AI tells to avoid (review every page against this)

Monospace micro-labels; "01 —" numbering on things that aren't a sequence; middle-dot meta strings; all-caps eyebrows or kickers above headings; one word in a headline accented in a different colour/italic; cream + terracotta palettes; #111 instead of black; "→" appended to links; gradient washes and glass blur as decoration; identical rounded SaaS cards as the whole structure; hero metric counters ("12 years, 150 projects"); fade-up on every section.

## Also from Josef's own references

Likes: Montarville (giant cropped wordmark), PDA (typographic project list, name split to the edges), Heron (instrument-like precision), Jonny Czar's portfolio (centred bold headline, B&W portrait cut-out, icon highlights, N26-style case study blocks with a stat bar and one CTA). Dislikes: Edison Fang (nothing anchors the eye), dense all-caps labels, decorative grids, hazard stripes, pulsing CTAs, forced scroll sequences that trap the user.
