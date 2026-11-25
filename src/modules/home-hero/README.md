# Home hero (`home-hero`, v2: workshop desk)

Name and one line on a warm paper desk (`--desk`), a closed laptop below them, A4 working pages, a pencil, crumbs and a cappuccino with steam.

- Pages: "home". Island: yes (`island.ts`, GSAP).
- Desktop with motion: the section is 175svh with a sticky stage. Native scroll; crossing 10% of the travel plays a fixed 1.05s tween (lid opens to 158°, name lifts away, warm screen glow); scrolling back under 6% closes it. The screen loops name → line → "Scroll to projects" (~8s). Pause button stops the loop and steam; offscreen and hidden tabs pause too; an explicit pause is kept.
- Phones (≤860px), reduced motion, no JS: a still composition with the laptop open, then the floor's vertical list.
- "Scroll to projects" goes to `#featured` (the floor) and focuses the first stop; with no featured build it goes to `/projects`.
- Working pages: up to 6 A4 scans (210:297, Fill). Empty slots render as blank ruled paper. Scans are shown greyscale and multiplied into the paper. The desk is seen from above, so a flat page needs only rotation: no manual warping.
- v1 → v2 migrate keeps Josef's edited headline/line; only untouched v1 defaults change. Portrait and phone were dropped from Home (handoff brief); the About portrait stays.
