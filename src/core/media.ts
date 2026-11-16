/** R2 URL + srcset helpers (architecture §10). */
import type { ImageValue } from "./fields";

export function mediaBase(configured: string | undefined): string {
  return (configured || "/media").replace(/\/$/, "");
}

export function srcFor(base: string, v: ImageValue, w: number): string {
  return `${base}/${v.key}/${w}.webp`;
}

export function srcset(base: string, v: ImageValue): string {
  return (v.widths ?? []).map((w) => `${srcFor(base, v, w)} ${w}w`).join(", ");
}

export function fallbackSrc(base: string, v: ImageValue): string {
  const ws = v.widths ?? [];
  const pick = ws.filter((w) => w <= 1600).at(-1) ?? ws[0];
  return pick ? srcFor(base, v, pick) : `${base}/${v.key}/${v.original ?? "orig"}`;
}

export const VARIANT_WIDTHS = [480, 960, 1600, 2400] as const;
