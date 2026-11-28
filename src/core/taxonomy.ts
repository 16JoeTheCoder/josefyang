export interface TaxonomyTerm {
  id: string;
  kind: "category" | "tag";
  name: string;
  slug: string;
  description: string;
}

export const FAILURE_CATEGORY_ID = "category-failure";
export const TAXONOMY_SQL = "SELECT id, kind, name, slug, description FROM devlog_taxonomy ORDER BY kind, name COLLATE NOCASE";

export function stringList(source: string | null | undefined): string[] {
  try {
    const items: unknown = JSON.parse(source ?? "[]");
    return Array.isArray(items) ? items.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

export function assignedTerms(source: string | null | undefined, terms: ReadonlyMap<string, TaxonomyTerm>, kind: TaxonomyTerm["kind"]): TaxonomyTerm[] {
  return [...new Set(stringList(source))].flatMap((id) => {
    const term = terms.get(id);
    return term?.kind === kind ? [term] : [];
  });
}

export function postDraft<T extends { draft_json?: string | null }>(row: T): T {
  if (!row.draft_json) return row;
  try {
    const draft: unknown = JSON.parse(row.draft_json);
    return draft && typeof draft === "object" && !Array.isArray(draft) ? { ...row, ...draft } : row;
  } catch { return row; }
}
