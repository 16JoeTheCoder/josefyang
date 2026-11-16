/**
 * Module registry (architecture §5.6). Auto-discovers every src/modules/<id>/module.ts at build time.
 * Throws at build/test time (never at request time) on duplicate ids or defaults that fail their own schema.
 */
import { fieldsToZod, type Fields } from "./fields";
import type { ModuleDef } from "./module";

const found = import.meta.glob<{ default: ModuleDef<Fields> }>("../modules/*/module.ts", { eager: true });

export const modules: Record<string, ModuleDef<Fields>> = {};
export const schemas: Record<string, ReturnType<typeof fieldsToZod>> = {};

for (const [path, mod] of Object.entries(found)) {
  const m = mod.default;
  const folder = path.split("/").at(-2);
  if (m.id !== folder) throw new Error(`Module in ${path} has id "${m.id}" but lives in folder "${folder}"`);
  if (modules[m.id]) throw new Error(`Duplicate module id "${m.id}"`);
  const schema = fieldsToZod(m.fields);
  const res = schema.safeParse(m.defaults);
  if (!res.success) throw new Error(`Module "${m.id}" defaults fail its schema: ${res.error.message}`);
  modules[m.id] = m;
  schemas[m.id] = schema;
}

export function getModule(id: string): ModuleDef<Fields> | undefined {
  return modules[id];
}
