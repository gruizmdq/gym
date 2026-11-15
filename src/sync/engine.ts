import { db, type Syncable } from '../data/db'
import { type RemoteRow, TABLES, type TableDefinition } from './tables'

// What the engine needs from the server. In the app it's Supabase; in tests, an in-memory fake.
export interface Remote {
  push(table: string, rows: RemoteRow[], conflict: string): Promise<void>
  pull(table: string, since: number, limit: number): Promise<RemoteRow[]>
}

export type Decision = 'save' | 'keep' | 'delete'

// What to do with a row that comes from the server (phase 4 case table).
export function resolve(
  local: Syncable | undefined,
  remote: { updatedAt: number; deleted: boolean },
): Decision {
  if (remote.deleted) return 'delete'
  if (!local || local.pending === 0) return 'save'
  // With an unpushed change, the newest wins. Equal = the echo of what we already pushed.
  return local.updatedAt > remote.updatedAt ? 'keep' : 'save'
}

const PUSH_BATCH = 500
const PULL_BATCH = 1000

function batches<T>(rows: T[], size: number): T[][] {
  const res: T[][] = []
  for (let i = 0; i < rows.length; i += size) res.push(rows.slice(i, i + size))
  return res
}

// biome-ignore lint/suspicious/noExplicitAny: each table has its own type; here they're walked together.
type AnyTable = TableDefinition<any>

async function pushTable(def: AnyTable, remote: Remote, userId: string): Promise<void> {
  const table = db.table(def.local)
  const pending: Syncable[] = await table.where('pending').equals(1).toArray()
  for (const batch of batches(pending, PUSH_BATCH)) {
    await remote.push(
      def.remote,
      batch.map((r) => def.toRemote(r, userId)),
      def.conflict,
    )
    // If the row changed while pushing, it stays pending: the new version goes in the next push.
    await db.transaction('rw', table, async () => {
      for (const pushed of batch) {
        const key = def.localKey(pushed)
        const current: Syncable | undefined = await table.get(key)
        if (current && current.updatedAt === pushed.updatedAt) {
          await table.update(key, { pending: 0 })
        }
      }
    })
  }
}

async function pullTable(def: AnyTable, remote: Remote, limit: number): Promise<void> {
  const table = db.table(def.local)
  const cursorKey = `cursor:${def.local}`
  let cursor = (await db.meta.get(cursorKey))?.value ?? 0

  for (;;) {
    const rows = await remote.pull(def.remote, cursor, limit)
    if (!rows.length) return
    await db.transaction('rw', table, db.meta, async () => {
      for (const row of rows) {
        const key = def.remoteKey(row)
        const decision = resolve(await table.get(key), {
          updatedAt: Date.parse(String(row.updated_at)),
          deleted: row.deleted_at !== null && row.deleted_at !== undefined,
        })
        if (decision === 'delete') await table.delete(key)
        if (decision === 'save') await table.put(def.toLocal(row))
      }
      cursor = Number(rows.at(-1)?.seq ?? cursor)
      await db.meta.put({ key: cursorKey, value: cursor })
    })
    if (rows.length < limit) return
  }
}

export async function pushPending(remote: Remote, userId: string): Promise<void> {
  for (const def of TABLES) await pushTable(def, remote, userId)
}

export async function pullChanges(remote: Remote, limit = PULL_BATCH): Promise<void> {
  for (const def of TABLES) await pullTable(def, remote, limit)
}

export async function sync(remote: Remote, userId: string): Promise<void> {
  await pushPending(remote, userId)
  await pullChanges(remote)
}

export async function countPending(): Promise<number> {
  const counts = await Promise.all(
    TABLES.map((def) => db.table(def.local).where('pending').equals(1).count()),
  )
  return counts.reduce((a, b) => a + b, 0)
}
