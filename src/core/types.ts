import type { BlockDoc } from "./blocks";
import type { BuildMeta } from "./build-fields";
import type { ImageValue } from "./fields";
import type { Section } from "./module";
import type { SiteSettings } from "./settings";
import type { TaxonomyTerm } from "./taxonomy";

export type Mode = "draft" | "published";

export interface BuildDoc { slug: string; meta: BuildMeta; sections: Section[] }

export interface BuildRecord extends BuildDoc {
  id: string;
  templateId: string;
  templateVer: number;
  updatedAt: number;
  publishedAt: number | null;
}

export interface DevlogEntry {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  buildId: string | null;
  build: { slug: string; title: string; failed: boolean } | null;
  hero: ImageValue | null;
  images: ImageValue[];

  readMinutes: number | null;
  date: string;
  status: "draft" | "published";
  updatedAt: number;
  /** Rich-text document; null for posts written before the editor (use `body`). */
  blocks: BlockDoc | null;
  type: "note" | "article";
  tags: string[];
  tagTerms: TaxonomyTerm[];
  categories: string[];
  categoryTerms: TaxonomyTerm[];
  sites: ("main" | "games")[];
  gameSlug: string | null;
  /** ISO datetime; a published post stays hidden until this time. */
  publishAt: string | null;
  seoTitle: string;
  seoDescription: string;
}

export interface Milestone { id: string; date: string; label: string; title: string; body: string; status: string }

export interface PageData {
  mode: Mode;
  settings: SiteSettings;
  builds: BuildRecord[];
  devlog: DevlogEntry[];
  milestones: Milestone[];
  /** Set on /builds/[slug]. */
  build?: BuildRecord;
  /** Set on /devlog/[slug]. */
  entry?: DevlogEntry;
}
