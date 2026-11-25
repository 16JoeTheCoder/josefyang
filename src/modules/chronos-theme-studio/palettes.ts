/**
 * Palette-preview colours for the theme studio. These are sample swatches of the six importable
 * theme files in public/chronos/themes/ (an illustration of the downloadable theme, not site colours),
 * so they live here as data and reach the page as CSS custom properties.
 */
export const MODES = ["dark", "light"] as const;
export const ACCENTS = ["orange", "blue", "violet"] as const;
export type Mode = (typeof MODES)[number];
export type Accent = (typeof ACCENTS)[number];

const surface: Record<Mode, { ground: string; text: string; muted: string; line: string }> = {
  dark: { ground: "#0b1115", text: "#f4f8ff", muted: "#c8d4db", line: "#31404a" },
  light: { ground: "#dfe1e4", text: "#15171a", muted: "#474b51", line: "#92969b" },
};
const accent: Record<Mode, Record<Accent, string>> = {
  dark: { orange: "#ff9c6d", blue: "#7fd7ff", violet: "#bea4ff" },
  light: { orange: "#a43a0d", blue: "#174dad", violet: "#603eb8" },
};

export const themeFile = (mode: Mode, a: Accent) => `/chronos/themes/studio-${mode}-${a}.chronos-theme.json`;

/** One CSS rule per surface and accent, keyed by the data attributes the island flips. */
export function paletteCss(scope: string): string {
  let css = "";
  for (const m of MODES) for (const a of ACCENTS) {
    const s = surface[m];
    css += `${scope}[data-mode="${m}"][data-accent="${a}"]{--ct-ground:${s.ground};--ct-text:${s.text};--ct-muted:${s.muted};--ct-line:${s.line};--ct-accent:${accent[m][a]}}`;
  }
  for (const a of ACCENTS) css += `.cts-dot-${a}{background:${accent.dark[a]}}`;
  return css;
}
