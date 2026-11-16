import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { ImageValue } from "../core/fields";

export interface MediaItem { id: string; key: string; original: string; widths: number[]; transparent: boolean; name: string; w: number | null; h: number | null; alt: string; bytes: number | null; createdAt: number; uses: number }

export interface AdminCtx {
  media: MediaItem[];
  refreshMedia: () => Promise<void>;
  /** Opens the media picker; resolves with the chosen item or null. */
  pickMedia: (opts?: { minWidth?: number }) => Promise<MediaItem | null>;
  toast: (msg: string) => void;
}
export const Ctx = createContext<AdminCtx>(null as unknown as AdminCtx);
export const useAdmin = () => useContext(Ctx);

export const thumb = (m: { key?: string; widths?: number[]; original?: string }) =>
  m.key ? `/media/${m.key}/${m.widths?.[0] ? `${m.widths[0]}.webp` : m.original ?? ""}` : "";

export function imageFromMedia(m: MediaItem, prev: ImageValue): ImageValue {
  return {
    ...prev,
    mediaId: m.id, key: m.key, widths: m.widths, original: m.original, w: m.w ?? undefined, h: m.h ?? undefined,
    transparent: m.transparent, alt: prev.alt || m.alt, focal: prev.mediaId ? prev.focal : { x: 0.5, y: 0.5 }, zoom: prev.mediaId ? prev.zoom : 1,
  };
}

export const ago = (t: number) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
};
