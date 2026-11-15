import type { SupabaseClient } from '@supabase/supabase-js'
import type { Syncable } from '../src/data/db'
import type { RemoteRow, TableDefinition } from '../src/sync/tables'

// Gonza's rows in the app's shape, with the same mapping the sync uses. Soft-deleted rows don't
// exist for the tools.

export class DataError extends Error {}

// PostgREST answers at most 1000 rows per request.
const PAGE = 1000
// Ids per `in` filter: they travel in the URL.
const IDS = 100

type Query = ReturnType<ReturnType<SupabaseClient['from']>['select']>

export async function readAll<L extends Syncable>(
  db: SupabaseClient,
  table: TableDefinition<L>,
  filter: (q: Query) => Query = (q) => q,
): Promise<L[]> {
  const rows: RemoteRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await filter(db.from(table.remote).select('*'))
      .is('deleted_at', null)
      .order('seq')
      .range(from, from + PAGE - 1)
    if (error) throw new DataError(error.message)
    rows.push(...(data as RemoteRow[]))
    if (data.length < PAGE) break
  }
  return rows.map(table.toLocal)
}

export async function readByIds<L extends Syncable>(
  db: SupabaseClient,
  table: TableDefinition<L>,
  column: string,
  ids: string[],
): Promise<L[]> {
  const unique = [...new Set(ids)]
  const result: L[] = []
  for (let i = 0; i < unique.length; i += IDS) {
    result.push(...(await readAll(db, table, (q) => q.in(column, unique.slice(i, i + IDS)))))
  }
  return result
}

// Like a write from the phone: `updatedAt` is now, so it wins over older versions (the trigger
// discards those), and the phone gets it in its next pull.
export async function write<L extends Syncable>(
  db: SupabaseClient,
  table: TableDefinition<L>,
  row: L,
  userId: string,
): Promise<void> {
  const { error } = await db
    .from(table.remote)
    .upsert(table.toRemote(row, userId), { onConflict: table.conflict })
  if (error) throw new DataError(error.message)
}

export async function update(
  db: SupabaseClient,
  table: string,
  id: string,
  values: RemoteRow,
): Promise<void> {
  const { error } = await db.from(table).update(values).eq('id', id)
  if (error) throw new DataError(error.message)
}
