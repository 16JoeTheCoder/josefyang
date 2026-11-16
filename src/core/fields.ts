/**
 * Field-type library (architecture §5.3, amended by §0.8–0.9 and 05-text-and-image-spec).
 * A module declares plain-data field descriptors. From them we derive:
 * the Zod schema (API + render validation), the admin form, the Text/Images panels and the fit check.
 * Descriptors are plain objects so the Preact admin can import them too.
 */
import { z } from "zod";

export type Role = "giant" | "heading" | "subheading" | "body" | "label" | "button" | "pill";
export type ImageMode = "fill" | "fit" | "object";

export interface TextField {
  kind: "text";
  label: string;
  role: Role;
  /** Hard character limit. */
  max: number;
  maxLines: number;
  /** Characters that fit in maxLines at the role size. Defaults to max (always fits). */
  fit?: number;
  multiline?: boolean;
  optional?: boolean;
}
export interface ImageField {
  kind: "image";
  label: string;
  /** CSS aspect-ratio, e.g. "4 / 3". */
  ratio: string;
  modes: ImageMode[];
  /** Short label shown in the empty state. */
  empty: string;
}
export interface UrlField { kind: "url"; label: string; optional?: boolean }
export interface NumberField { kind: "number"; label: string; min: number; max: number; step?: number; optional?: boolean }
export interface ToggleField { kind: "toggle"; label: string }
export interface SelectField { kind: "select"; label: string; options: { value: string; label: string }[] }
export interface DateField { kind: "date"; label: string; optional?: boolean }
export interface ListField { kind: "list"; label: string; itemLabel: string; of: Fields; min: number; max: number }
export interface GroupField { kind: "group"; label: string; fields: Fields }

export type Field =
  | TextField | ImageField | UrlField | NumberField | ToggleField
  | SelectField | DateField | ListField | GroupField;
export type Fields = Record<string, Field>;

/* ---------- stored value shapes ---------- */

export interface TextValue { value: string }
export interface Focal { x: number; y: number }
export interface ImageValue {
  mediaId: string | null;
  /** R2 key prefix for this upload, e.g. "m/ab12cd34". */
  key?: string;
  /** Generated WebP widths available under `${key}/${w}.webp`. */
  widths?: number[];
  /** Original file name inside the key prefix, e.g. "orig.png". */
  original?: string;
  w?: number;
  h?: number;
  transparent?: boolean;
  focal: Focal;
  zoom: number;
  mode: ImageMode;
  alt: string;
}

type ValueOf<F extends Field> =
  F extends TextField ? TextValue :
  F extends ImageField ? ImageValue :
  F extends UrlField ? string :
  F extends NumberField ? number :
  F extends ToggleField ? boolean :
  F extends SelectField ? string :
  F extends DateField ? string :
  F extends ListField ? Content<F["of"]>[] :
  F extends GroupField ? Content<F["fields"]> :
  never;
export type Content<FS extends Fields> = { [K in keyof FS]: ValueOf<FS[K]> };

/* ---------- descriptor helpers ---------- */

type TextOpts = Omit<TextField, "kind" | "role" | "label">;
const text = (role: Role) => (label: string, o: TextOpts): TextField => ({ kind: "text", role, label, ...o });

export const f = {
  giant: text("giant"),
  heading: text("heading"),
  subheading: text("subheading"),
  body: text("body"),
  label: text("label"),
  button: (label: string, max = 18): TextField => ({ kind: "text", role: "button", label, max, maxLines: 1 }),
  pill: (label: string, max = 22): TextField => ({ kind: "text", role: "pill", label, max, maxLines: 1 }),
  image: (label: string, ratio: string, modes: ImageMode[], empty: string): ImageField =>
    ({ kind: "image", label, ratio, modes, empty }),
  url: (label: string, optional = true): UrlField => ({ kind: "url", label, optional }),
  number: (label: string, min: number, max: number, step = 1): NumberField => ({ kind: "number", label, min, max, step }),
  toggle: (label: string): ToggleField => ({ kind: "toggle", label }),
  select: (label: string, options: { value: string; label: string }[]): SelectField => ({ kind: "select", label, options }),
  date: (label: string, optional = true): DateField => ({ kind: "date", label, optional }),
  list: <FS extends Fields>(label: string, itemLabel: string, of: FS, min: number, max: number) =>
    ({ kind: "list", label, itemLabel, of, min, max }) as const satisfies ListField,
  group: <FS extends Fields>(label: string, fields: FS) => ({ kind: "group", label, fields }) as const satisfies GroupField,
};

/* ---------- value constructors for defaults ---------- */

export const t = (value: string): TextValue => ({ value });
export const noImage = (mode: ImageMode = "fill", alt = ""): ImageValue =>
  ({ mediaId: null, focal: { x: 0.5, y: 0.5 }, zoom: 1, mode, alt });

/* ---------- Zod ---------- */

const urlSchema = z.string().max(500).refine(
  (v) => v === "" || /^(https?:\/\/|mailto:|\/(?![\/\\]))/.test(v),
  "Must start with https://, mailto: or /",
);

export function fieldToZod(fd: Field): z.ZodType {
  switch (fd.kind) {
    case "text": {
      // Hard max is enforced at publish (so a draft can be over and shown in orange); storage cap is generous.
      return z.object({ value: z.string().max(Math.max(fd.max * 3, 400)) });
    }
    case "image":
      return z.object({
        mediaId: z.string().max(64).nullable(),
        key: z.string().max(80).optional(),
        widths: z.array(z.number().int().positive()).max(8).optional(),
        original: z.string().max(40).optional(),
        w: z.number().optional(),
        h: z.number().optional(),
        transparent: z.boolean().optional(),
        focal: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
        zoom: z.number().min(1).max(3),
        mode: z.enum(["fill", "fit", "object"]),
        alt: z.string().max(200),
      });
    case "url": return urlSchema;
    case "number": return z.number().min(fd.min).max(fd.max);
    case "toggle": return z.boolean();
    case "select": return z.enum(fd.options.map((o) => o.value) as [string, ...string[]]);
    case "date": return z.string().regex(/^(\d{4}-\d{2}(-\d{2})?)?$/, "Use YYYY-MM or YYYY-MM-DD");
    case "list": return z.array(fieldsToZod(fd.of)).max(fd.max);
    case "group": return fieldsToZod(fd.fields);
  }
}

export function fieldsToZod(fs: Fields): z.ZodObject {
  const shape: Record<string, z.ZodType> = {};
  for (const [k, v] of Object.entries(fs)) shape[k] = fieldToZod(v);
  return z.object(shape);
}

/* ---------- text fit (05-text-and-image-spec §1) ---------- */

export type FitState = 0 | 1 | 2 | "over";
/** Each step down the type scale holds ~20% more characters. */
const STEP_GAIN = 1.2;

export function fitStep(value: string, fd: TextField): FitState {
  const len = [...value].length;
  if (len > fd.max) return "over";
  const fit = fd.fit ?? fd.max;
  if (len <= fit) return 0;
  if (fd.role === "pill" || fd.role === "button") return "over";
  if (len <= fit * STEP_GAIN) return 1;
  if (len <= fit * STEP_GAIN * STEP_GAIN) return 2;
  return "over";
}

/* ---------- walking content (Text/Images panels, publish checks, media usage) ---------- */

export interface Slot<F extends Field = Field> { path: string; field: F; value: unknown }

export function walk(fs: Fields, content: unknown, base = ""): Slot[] {
  const out: Slot[] = [];
  const obj = (content ?? {}) as Record<string, unknown>;
  for (const [k, fd] of Object.entries(fs)) {
    const path = base ? `${base}.${k}` : k;
    const v = obj[k];
    if (fd.kind === "list") {
      (Array.isArray(v) ? v : []).forEach((item, i) => out.push(...walk(fd.of, item, `${path}[${i}]`)));
    } else if (fd.kind === "group") {
      out.push(...walk(fd.fields, v, path));
    } else {
      out.push({ path, field: fd, value: v });
    }
  }
  return out;
}

export interface Problem { path: string; label: string; message: string }

/** Everything that blocks publishing: too-long text, missing required text, images without alt text. */
export function publishProblems(fs: Fields, content: unknown, base = ""): Problem[] {
  const problems: Problem[] = [];
  for (const s of walk(fs, content, base)) {
    if (s.field.kind === "text") {
      const v = (s.value as TextValue | undefined)?.value ?? "";
      const st = fitStep(v, s.field);
      if (st === "over") {
        const over = Math.max(1, [...v].length - Math.floor((s.field.fit ?? s.field.max) * (s.field.role === "pill" || s.field.role === "button" ? 1 : STEP_GAIN * STEP_GAIN)));
        problems.push({ path: s.path, label: s.field.label, message: `Too long for this spot: ${Math.min(over, [...v].length)} characters over. Shorten it.` });
      }
    } else if (s.field.kind === "image") {
      const v = s.value as ImageValue | undefined;
      if (v?.mediaId && !v.alt.trim()) problems.push({ path: s.path, label: s.field.label, message: "Add alt text before publishing." });
    }
  }
  return problems;
}

/** Media ids referenced by content, with their field paths (for media_usage). */
export function mediaRefs(fs: Fields, content: unknown, base = ""): { mediaId: string; path: string }[] {
  return walk(fs, content, base)
    .filter((s) => s.field.kind === "image" && (s.value as ImageValue | undefined)?.mediaId)
    .map((s) => ({ mediaId: (s.value as ImageValue).mediaId as string, path: s.path }));
}

/** Fill missing keys from defaults (used when a module gains a field). */
export function withDefaults<T>(defaults: T, content: unknown): T {
  if (Array.isArray(defaults)) return (Array.isArray(content) ? content : defaults) as T;
  if (defaults && typeof defaults === "object") {
    const c = (content && typeof content === "object" ? content : {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, d] of Object.entries(defaults as Record<string, unknown>)) {
      out[k] = k in c ? (d && typeof d === "object" && !Array.isArray(d) && !("value" in d) && !("mediaId" in d) ? withDefaults(d, c[k]) : c[k]) : d;
    }
    return out as T;
  }
  return (content === undefined ? defaults : content) as T;
}
