/** Form controls built from field descriptors (architecture §5.3). No drag-and-drop: lists use Move up / Move down. */
import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { fitStep, type Field, type Fields, type ImageField, type ImageValue, type ListField, type TextField, type TextValue, type VideoField, type VideoValue, noImage, noVideo, t } from "../core/fields";
import { imageFromMedia, thumb, useAdmin, videoFromMedia, videoSrc } from "./state";

type Obj = Record<string, unknown>;

/** Plain-English names for the type roles. */
const ROLE_NAME: Record<TextField["role"], string> = { giant: "Big headline", heading: "Heading", subheading: "Subheading", body: "Paragraph", label: "Short label", button: "Button text", pill: "Tag" };
export const roleLine = (f: TextField) => `${ROLE_NAME[f.role]} · ${f.role === "body" ? "up to" : "fits"} ${f.maxLines} line${f.maxLines === 1 ? "" : "s"}`;

/** How many characters past the limit (0 when it still fits, even if it shrinks). */
export function overBy(value: string, fd: TextField): number {
  const len = [...value].length;
  if (fitStep(value, fd) !== "over") return 0;
  const limit = Math.min(fd.max, Math.floor((fd.fit ?? fd.max) * (fd.role === "pill" || fd.role === "button" ? 1 : 1.44)));
  return Math.max(1, len - limit);
}

/** The slot's shape in words. */
export function shapeName(ratio: string): string {
  const [w, h] = ratio.split("/").map((x) => Number(x.trim()));
  if (!w || !h) return ratio;
  if (w === 210 && h === 297) return "A4 portrait";
  const r = w / h;
  const label = `${w}:${h}`;
  if (Math.abs(r - 1) < 0.02) return "Square";
  if (r >= 2) return `Panorama ${label}`;
  if (r >= 1.6) return `Wide ${label}`;
  if (r > 1) return `Landscape ${label}`;
  return `Portrait ${label}`;
}
const MODE_NAME = { fill: "Fill the frame (crops the edges)", fit: "Show the whole image", object: "Cut-out (transparent background)" } as const;

export function emptyValue(fd: Field): unknown {
  switch (fd.kind) {
    case "text": return t("");
    case "image": return noImage(fd.modes[0]);
    case "video": return noVideo();
    case "url": case "date": return "";
    case "number": return fd.min;
    case "toggle": return false;
    case "select": return fd.options[0]?.value ?? "";
    case "list": return [];
    case "group": return Object.fromEntries(Object.entries(fd.fields).map(([k, f]) => [k, emptyValue(f)]));
  }
}

export function FitBadge({ value, field }: { value: string; field: TextField }) {
  const st = fitStep(value, field);
  const n = overBy(value, field);
  const text = st === 0 ? "Fits" : st === "over" ? `Too long by ${n} character${n === 1 ? "" : "s"}` : "Will shrink a little";
  return <span class={`fit fit-${st}`}>{text}</span>;
}

export function FieldsForm({ fields, value, onChange, path = "" }: { fields: Fields; value: Obj; onChange: (v: Obj) => void; path?: string }) {
  return (
    <div class="fields">
      {Object.entries(fields).map(([k, fd]) => (
        <FieldControl key={k} id={`${path}.${k}`} field={fd} value={value?.[k]} onChange={(v) => onChange({ ...value, [k]: v })} />
      ))}
    </div>
  );
}

export function FieldControl({ id, field, value, onChange }: { id: string; field: Field; value: unknown; onChange: (v: unknown) => void }): JSX.Element {
  const fid = `f${id.replace(/[^\w]/g, "_")}`;
  switch (field.kind) {
    case "text": {
      const v = (value as TextValue | undefined)?.value ?? "";
      const len = [...v].length;
      const near = len > field.max * 0.8;
      const Input = field.multiline || field.max > 120 ? "textarea" : "input";
      return (
        <div class="field" data-field-path={id}>
          <label for={fid}>{field.label} <span class="role">{roleLine(field)}</span></label>
          <Input id={fid} value={v} rows={field.multiline ? 6 : 3} onInput={(e) => onChange({ value: (e.target as HTMLInputElement).value })} class={fitStep(v, field) === "over" ? "over" : ""} />
          <div class="hint"><FitBadge value={v} field={field} />{near && <span class={len > field.max ? "count over" : "count"}>{len} / {field.max}</span>}</div>
        </div>
      );
    }
    case "image": return <ImageControl id={fid} path={id} field={field} value={(value as ImageValue) ?? noImage(field.modes[0])} onChange={onChange} />;
    case "video": return <VideoControl id={fid} field={field} value={(value as VideoValue) ?? noVideo()} onChange={onChange} />;
    case "url":
      return <div class="field"><label for={fid}>{field.label}</label><input id={fid} type="url" inputMode="url" value={(value as string) ?? ""} placeholder="https://" onInput={(e) => onChange((e.target as HTMLInputElement).value.trim())} /></div>;
    case "date":
      return <div class="field"><label for={fid}>{field.label}</label><input id={fid} value={(value as string) ?? ""} placeholder="YYYY-MM-DD" onInput={(e) => onChange((e.target as HTMLInputElement).value.trim())} /></div>;
    case "number":
      return <div class="field field-inline"><label for={fid}>{field.label}</label><input id={fid} type="number" min={field.min} max={field.max} step={field.step ?? 1} value={String(value ?? field.min)} onInput={(e) => { const n = Number((e.target as HTMLInputElement).value); if (!Number.isNaN(n)) onChange(Math.min(field.max, Math.max(field.min, n))); }} /></div>;
    case "toggle":
      return <div class="field field-inline"><label class="switch"><input type="checkbox" checked={!!value} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} /><span>{field.label}</span></label></div>;
    case "select":
      return <div class="field field-inline"><label for={fid}>{field.label}</label><select id={fid} value={String(value ?? "")} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>{field.options.map((o) => <option value={o.value}>{o.label}</option>)}</select></div>;
    case "group":
      return <fieldset class="group"><legend>{field.label}</legend><FieldsForm fields={field.fields} value={(value as Obj) ?? {}} onChange={onChange} path={id} /></fieldset>;
    case "list": return <ListControl id={id} field={field} value={(value as Obj[]) ?? []} onChange={onChange} />;
  }
}

function ListControl({ id, field, value, onChange }: { id: string; field: ListField; value: Obj[]; onChange: (v: unknown) => void }) {
  const move = (i: number, d: number) => { const a = [...value]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x!); onChange(a); };
  return (
    <fieldset class="group list">
      <legend>{field.label} <span class="muted">({value.length} / {field.max})</span></legend>
      {value.map((item, i) => (
        <div class="list-item" key={i}>
          <div class="list-bar">
            <strong>{field.itemLabel} {i + 1}</strong>
            <span>
              <button type="button" class="mini" disabled={i === 0} onClick={() => move(i, -1)}>Move up</button>
              <button type="button" class="mini" disabled={i === value.length - 1} onClick={() => move(i, 1)}>Move down</button>
              <button type="button" class="mini danger" disabled={value.length <= field.min} onClick={() => onChange(value.filter((_, k) => k !== i))}>Remove</button>
            </span>
          </div>
          <FieldsForm fields={field.of} value={item} onChange={(v) => onChange(value.map((x, k) => (k === i ? v : x)))} path={`${id}[${i}]`} />
        </div>
      ))}
      {value.length < field.max && <button type="button" class="ghost" onClick={() => onChange([...value, emptyValue({ kind: "group", label: "", fields: field.of })])}>Add {field.itemLabel.toLowerCase()}</button>}
    </fieldset>
  );
}

export function VideoControl({ id, field, value, onChange }: { id: string; field: VideoField; value: VideoValue; onChange: (v: VideoValue) => void }) {
  const { pickMedia } = useAdmin();
  const src = value.mediaId ? videoSrc(value) : "";
  const choose = async () => {
    const m = await pickMedia({ kind: "video" });
    if (m) onChange(videoFromMedia(m, value));
  };
  return (
    <div class="field video-field" data-field-path={id}>
      <label>{field.label} <span class="muted">MP4, up to 25 MB</span></label>
      {src ? <video class="video-prev" src={src} controls muted playsInline preload="metadata" /> : <p class="muted small">{field.empty}</p>}
      <div class="img-ctrls">
        <button type="button" onClick={choose}>{value.mediaId ? "Replace video" : "Choose or upload a video"}</button>
        {value.mediaId && (
          <>
            <label for={`${id}-alt`}>What the clip shows (required)</label>
            <input id={`${id}-alt`} value={value.alt} class={value.alt.trim() ? "" : "over"} onInput={(e) => onChange({ ...value, alt: (e.target as HTMLInputElement).value })} />
            <button type="button" class="mini danger" onClick={() => onChange({ mediaId: null, alt: value.alt })}>Remove video</button>
          </>
        )}
      </div>
    </div>
  );
}

export function ImageControl({ id, path, field, value, onChange }: { id: string; path?: string; field: ImageField; value: ImageValue; onChange: (v: ImageValue) => void }) {
  const { pickMedia } = useAdmin();
  const [focalMode, setFocalMode] = useState(false);
  const src = thumb(value);
  const choose = async () => {
    const m = await pickMedia();
    if (m) onChange(imageFromMedia(m, { ...value, mode: value.mode }));
  };
  const setFocal = (e: MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onChange({ ...value, focal: { x: +((e.clientX - r.left) / r.width).toFixed(3), y: +((e.clientY - r.top) / r.height).toFixed(3) } });
  };
  return (
    <div class="field image-field" data-field-path={path}>
      <label>{field.label} <span class="muted">{shapeName(field.ratio)}</span></label>
      <div class="img-row">
        <div class="img-thumb" style={`aspect-ratio:${field.ratio}`}>
          {src ? (
            <button type="button" class="focal-btn" onClick={(e) => focalMode && setFocal(e as unknown as MouseEvent)} aria-label="Click the point that must stay visible">
              <img src={src} alt="" style={`object-fit:${value.mode === "fill" ? "cover" : "contain"};object-position:${value.focal.x * 100}% ${value.focal.y * 100}%`} />
              {focalMode && <span class="focal-dot" style={`left:${value.focal.x * 100}%;top:${value.focal.y * 100}%`} />}
            </button>
          ) : <span class="muted small">{field.empty}</span>}
        </div>
        <div class="img-ctrls">
          <button type="button" onClick={choose}>{value.mediaId ? "Replace in this slot" : "Choose or upload"}</button>
          {value.mediaId && (
            <>
              <label class="switch"><input type="checkbox" checked={focalMode} onChange={() => setFocalMode(!focalMode)} /><span>Set focal point (click the image)</span></label>
              {field.modes.length > 1 && (
                <label>How the image sits <select value={value.mode} onChange={(e) => onChange({ ...value, mode: (e.target as HTMLSelectElement).value as ImageValue["mode"] })}>
                  {field.modes.map((m) => <option value={m}>{MODE_NAME[m]}</option>)}
                </select></label>
              )}
              {field.modes.length === 1 && <p class="muted small">{MODE_NAME[value.mode]}</p>}
              {value.mode === "fill" && <label>Zoom <input type="range" min="1" max="3" step="0.05" value={value.zoom} onInput={(e) => onChange({ ...value, zoom: Number((e.target as HTMLInputElement).value) })} /></label>}
              {value.mode === "object" && value.transparent === false && <p class="warn small">No transparency: shows as a rounded tile until you upload a cut-out.</p>}
              <label for={`${id}-alt`}>Alt text (required)</label>
              <input id={`${id}-alt`} value={value.alt} class={value.alt.trim() ? "" : "over"} onInput={(e) => onChange({ ...value, alt: (e.target as HTMLInputElement).value })} />
              <button type="button" class="mini danger" onClick={() => onChange({ ...value, mediaId: null, key: undefined, widths: undefined, original: undefined })}>Remove image</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
