// Writing a dataset into a table (P6-04) so that importing the same release again changes nothing: what is already
// there is read once (only the fields that matter), and only new rows are inserted and changed rows updated.

export type Changes = { inserted: number; updated: number; unchanged: number };
export const noChanges = (): Changes => ({ inserted: 0, updated: 0, unchanged: 0 });
export const add = (a: Changes, b: Changes): Changes => ({ inserted: a.inserted + b.inserted, updated: a.updated + b.updated, unchanged: a.unchanged + b.unchanged });

type Table = {
  findMany(args: object): Promise<Record<string, unknown>[]>;
  createMany(args: { data: object[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: object; data: object }): Promise<unknown>;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const CHUNK = 5000;

/**
 * Brings `table` in line with `rows`: `key` names what identifies a row (one unique field, or the fields of a
 * compound key, then `whereOf` builds its where), `fields` what is compared. Rows not in `rows` are left alone.
 */
export async function sync<R extends Record<string, unknown>>(
  table: Table,
  rows: R[],
  { key, fields, whereOf }: { key: (keyof R & string)[]; fields: (keyof R & string)[]; whereOf?: (r: R) => object },
): Promise<Changes> {
  const id = (r: Record<string, unknown>) => key.map((k) => String(r[k])).join("\u0001");
  const select = Object.fromEntries([...key, ...fields].map((f) => [f, true]));
  const existing = new Map<string, Record<string, unknown>>();
  for (const r of await table.findMany({ select })) existing.set(id(r), r);
  const changes = noChanges();
  const fresh: R[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const k = id(r);
    if (seen.has(k)) continue; // (a dataset can list the same thing twice)
    seen.add(k);
    const old = existing.get(k);
    if (!old) { fresh.push(r); continue; }
    const diff = Object.fromEntries(fields.filter((f) => !same(old[f], r[f])).map((f) => [f, r[f]]));
    if (!Object.keys(diff).length) { changes.unchanged++; continue; }
    await table.update({ where: whereOf ? whereOf(r) : { [key[0] as string]: r[key[0] as string] }, data: diff });
    changes.updated++;
  }
  for (let i = 0; i < fresh.length; i += CHUNK) changes.inserted += (await table.createMany({ data: fresh.slice(i, i + CHUNK), skipDuplicates: true })).count;
  return changes;
}
