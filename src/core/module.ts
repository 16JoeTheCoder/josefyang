import type { Content, Fields } from "./fields";

export type PageId = "home" | "projects" | "failures" | "devlog" | "about" | "build" | "games";

export interface ModuleDef<FS extends Fields = Fields> {
  id: string;
  name: string;
  version: number;
  /** One line for the admin and README. */
  description: string;
  fields: FS;
  defaults: Content<FS>;
  /** true = this module ships island.ts. */
  island: boolean;
  pages: PageId[];
  /** Upgrade content stored by an older version (architecture §5.5 #7). */
  migrate?: (old: unknown, fromVersion: number) => unknown;
}

export const defineModule = <FS extends Fields>(m: ModuleDef<FS>): ModuleDef<FS> => m;

export interface Section {
  sectionId: string;
  moduleId: string;
  moduleVersion: number;
  hidden?: boolean;
  content: unknown;
}
