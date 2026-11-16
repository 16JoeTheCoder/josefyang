/** Validation shared by the API: sections, build docs, settings. Zod is the gatekeeper (architecture §6.3). */
import { z } from "zod";
import { buildFields } from "./build-fields";
import { fieldsToZod, mediaRefs, publishProblems, withDefaults, type Fields, type Problem } from "./fields";
import type { Section } from "./module";
import { getModule, schemas } from "./registry";
import { settingsDefaults, settingsFields, type SettingsKey } from "./settings";

export const sectionShape = z.object({
  sectionId: z.string().min(1).max(64),
  moduleId: z.string().min(1).max(64),
  moduleVersion: z.number().int().positive(),
  hidden: z.boolean().optional(),
  content: z.unknown(),
});
export const sectionsShape = z.array(sectionShape).max(40);

export const buildMetaSchema = fieldsToZod(buildFields);
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes").max(60);
export const buildDocShape = z.object({ slug: slugSchema, meta: z.unknown(), sections: sectionsShape });

/** Validates each section against its module; returns cleaned sections or the first error. */
export function validateSections(sections: Section[]): { ok: true; sections: Section[] } | { ok: false; error: string } {
  const out: Section[] = [];
  for (const s of sections) {
    const m = getModule(s.moduleId);
    if (!m) return { ok: false, error: `Unknown module "${s.moduleId}"` };
    const content = withDefaults(m.defaults, s.moduleVersion < m.version && m.migrate ? m.migrate(s.content, s.moduleVersion) : s.content);
    const res = schemas[m.id]!.safeParse(content);
    if (!res.success) return { ok: false, error: `${m.name}: ${res.error.issues[0]?.path.join(".")} ${res.error.issues[0]?.message}` };
    out.push({ ...s, moduleVersion: m.version, content: res.data });
  }
  return { ok: true, sections: out };
}

export function sectionProblems(sections: Section[]): Problem[] {
  return sections.filter((s) => !s.hidden).flatMap((s) => {
    const m = getModule(s.moduleId);
    return m ? publishProblems(m.fields, s.content, `${s.sectionId}`).map((p) => ({ ...p, label: `${m.name}: ${p.label}` })) : [];
  });
}

export function sectionMedia(sections: Section[]): { mediaId: string; path: string }[] {
  return sections.flatMap((s, i) => {
    const m = getModule(s.moduleId);
    return m ? mediaRefs(m.fields, s.content, `sections[${i}].content`) : [];
  });
}

export function validateSettings(key: string, value: unknown) {
  if (!(key in settingsFields)) return { ok: false as const, error: "Unknown settings key" };
  const fields = settingsFields[key as SettingsKey] as Fields;
  const res = fieldsToZod(fields).safeParse(withDefaults(settingsDefaults[key as SettingsKey], value));
  if (!res.success) return { ok: false as const, error: `${res.error.issues[0]?.path.join(".")} ${res.error.issues[0]?.message}` };
  return { ok: true as const, value: res.data, fields };
}

export const buildProblems = (meta: unknown): Problem[] => publishProblems(buildFields, meta, "meta");
export const buildMedia = (meta: unknown) => mediaRefs(buildFields, meta, "meta");
