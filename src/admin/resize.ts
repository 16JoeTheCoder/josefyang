/**
 * Browser-side image resizing (architecture §10): decode (EXIF orientation applied), then WebP at
 * 480 / 960 / 1600 / 2400 px (only widths up to the original). AVIF encoding isn't reliable in browsers
 * yet, so variants are WebP only (see decisions.md). Originals are kept untouched.
 */
import { VARIANT_WIDTHS } from "../core/media";

export interface Prepared { width: number; height: number; transparent: boolean; variants: { w: number; blob: Blob }[]; warning?: string }

async function toWebp(bmp: ImageBitmap, w: number): Promise<Blob> {
  const h = Math.round((bmp.height * w) / bmp.width);
  if (typeof OffscreenCanvas !== "undefined") {
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, w, h);
    return c.convertToBlob({ type: "image/webp", quality: 0.82 });
  }
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  return new Promise((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("encode failed"))), "image/webp", 0.82));
}

function hasAlpha(bmp: ImageBitmap): boolean {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = s; c.height = s;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, s, s);
  const d = ctx.getImageData(0, 0, s, s).data;
  for (let i = 3; i < d.length; i += 4) if (d[i]! < 250) return true;
  return false;
}

export async function prepareImage(file: File, minWidth = 0): Promise<Prepared> {
  if (file.size > 20 * 1024 * 1024) throw new Error("Files can be up to 20 MB.");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This browser can't read that file. HEIC photos: export as JPEG on the phone first.");
  }
  const widths = VARIANT_WIDTHS.filter((w) => w <= bmp.width);
  if (!widths.length) widths.push(bmp.width as never);
  const variants = [];
  for (const w of widths) variants.push({ w, blob: await toWebp(bmp, w) });
  const out: Prepared = { width: bmp.width, height: bmp.height, transparent: hasAlpha(bmp), variants };
  if (minWidth && bmp.width < minWidth) out.warning = "Will look soft on large screens.";
  bmp.close();
  return out;
}
