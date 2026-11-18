import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Session, type SetRecord } from '../data/db'
import { pullChanges, pushPending, type Remote, resolve, sync } from './engine'
import type { RemoteRow } from './tables'

const USER = '00000000-0000-0000-0000-000000000001'

// In-memory server with the same rules as the Postgres trigger: each write takes the next
// sequence number and a version older than the stored one is ignored.
class FakeServer implements Remote {
  tables = new Map<string, Map<string, RemoteRow>>()
  seq = 0
  failing = false
  whilePushing: ((table: string) => Promise<void>) | null = null

  table(name: string) {
    let t = this.tables.get(name)
    if (!t) {
      t = new Map()
      this.tables.set(name, t)
    }
    return t
  }

  async push(table: string, rows: RemoteRow[], conflict: string) {
    if (this.failing) throw new Error('No signal')
    const t = this.table(table)
    for (const row of rows) {
      const key = conflict
        .split(',')
        .map((c) => row[c])
        .join('|')
      const previous = t.get(key)
      if (previous && Date.parse(String(row.updated_at)) < Date.parse(String(previous.updated_at)))
        continue
      t.set(key, { deleted_at: null, ...row, seq: ++this.seq })
    }
    await this.whilePushing?.(table)
  }

  async pull(table: string, since: number, limit: number) {
    return [...this.table(table).values()]
      .filter((r) => Number(r.seq) > since)
      .sort((a, b) => Number(a.seq) - Number(b.seq))
      .slice(0, limit)
  }

  write(table: string, key: string, row: RemoteRow) {
    this.table(table).set(key, {
      user_id: USER,
      deleted_at: null,
      ...row,
      seq: ++this.seq,
    })
  }
}

function session(extra: Partial<Session> = {}): Session {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    plan: '5d',
    day: 'lower-a',
    date: '2026-12-07',
    status: 'finished',
    mesocycle: 1,
    week: 1,
    deload: false,
    routineVersion: 'abc',
    startedAt: 1_000,
    finishedAt: 4_000,
    sortOrder: 4_000,
    chosen: { 'leg-press': 'hack-squat' },
    extraSets: {},
    skipped: ['crunch'],
    rest: null,
    notes: 'Dormí poco',
    updatedAt: 4_000,
    pending: 1,
    ...extra,
  }
}

function set(extra: Partial<SetRecord> = {}): SetRecord {
  return {
    id: '11111111-1111-1111-1111-111111111111:leg-press:hack-squat:1:-',
    sessionId: '11111111-1111-1111-1111-111111111111',
    slotId: 'leg-press',
    exerciseId: 'hack-squat',
    signature: 'lower-a|hack-squat|10-12|2-0-1-0|rest-pause',
    number: 1,
    side: null,
    weight: 112.5,
    unit: 'kg',
    reps: 12,
    tempoOk: true,
    techniqueDone: false,
    techniqueReps: null,
    done: true,
    updatedAt: 3_000,
    pending: 1,
    ...extra,
  }
}

beforeEach(async () => {
  db.close()
  await Dexie.delete('gym')
  await db.open()
})

describe('resolve: what happens to a row that comes from the server', () => {
  it.each<[string, Parameters<typeof resolve>[0], Parameters<typeof resolve>[1], string]>([
    ['not on the phone', undefined, { updatedAt: 5, deleted: false }, 'save'],
    ['no local changes', { updatedAt: 9, pending: 0 }, { updatedAt: 5, deleted: false }, 'save'],
    ['newer local change', { updatedAt: 9, pending: 1 }, { updatedAt: 5, deleted: false }, 'keep'],
    ['older local change', { updatedAt: 5, pending: 1 }, { updatedAt: 9, deleted: false }, 'save'],
    [
      'echo of what we already pushed',
      { updatedAt: 5, pending: 1 },
      { updatedAt: 5, deleted: false },
      'save',
    ],
    ['arrives deleted', { updatedAt: 9, pending: 1 }, { updatedAt: 5, deleted: true }, 'delete'],
  ])('%s → %s', (_case, local, remote, expected) => {
    expect(resolve(local, remote)).toBe(expected)
  })
})

describe('pushPending', () => {
  it('pushes what is pending and marks it up to date', async () => {
    const server = new FakeServer()
    await db.sessions.add(session())
    await db.sets.add(set())
    await pushPending(server, USER)
    expect(server.table('sets').size).toBe(1)
    expect(server.table('sessions').size).toBe(1)
    expect((await db.sets.get(set().id))?.pending).toBe(0)
  })

  it('if the row changes while pushing, it stays pending for the next push', async () => {
    const server = new FakeServer()
    await db.sessions.add(session())
    await db.sets.add(set())
    server.whilePushing = async (table) => {
      if (table !== 'sets') return
      await db.sets.update(set().id, { reps: 13, updatedAt: 9_000, pending: 1 })
    }
    await pushPending(server, USER)
    expect(await db.sets.get(set().id)).toMatchObject({ reps: 13, pending: 1 })
  })

  it('if it fails (no signal), everything stays pending', async () => {
    const server = new FakeServer()
    server.failing = true
    await db.sets.add(set())
    await expect(pushPending(server, USER)).rejects.toThrow('No signal')
    expect((await db.sets.get(set().id))?.pending).toBe(1)
  })

  it('pushes sessions before their sets', async () => {
    const order: string[] = []
    const server = new FakeServer()
    const push = server.push.bind(server)
    server.push = async (table, rows, conflict) => {
      order.push(table)
      await push(table, rows, conflict)
    }
    await db.sets.add(set())
    await db.sessions.add(session())
    await pushPending(server, USER)
    expect(order.indexOf('sessions')).toBeLessThan(order.indexOf('sets'))
  })
})

describe('pullChanges', () => {
  it('brings what is new page by page and stores the cursor', async () => {
    const server = new FakeServer()
    for (const n of [2, 3, 4]) {
      server.write('mesocycles', String(n), {
        number: n,
        plan: '5d',
        start: '2027-01-18',
        updated_at: new Date(1_000).toISOString(),
      })
    }
    await pullChanges(server, 2)
    expect((await db.mesocycles.toArray()).map((m) => m.number).sort()).toEqual([1, 2, 3, 4])
    expect((await db.meta.get('cursor:mesocycles'))?.value).toBe(3)
  })

  it('does not overwrite a phone change newer than the server one', async () => {
    const server = new FakeServer()
    await db.mesocycles.put({
      number: 1,
      plan: '4d',
      start: '2026-12-07',
      updatedAt: 9_000,
      pending: 1,
    })
    server.write('mesocycles', '1', {
      number: 1,
      plan: '5d',
      start: '2026-12-07',
      updated_at: new Date(5_000).toISOString(),
    })
    await pullChanges(server)
    expect(await db.mesocycles.get(1)).toMatchObject({ plan: '4d', pending: 1 })
  })

  it('deletes on the phone what arrives deleted', async () => {
    const server = new FakeServer()
    await db.sets.put({ ...set(), pending: 0 })
    server.write('sets', set().id, {
      id: set().id,
      updated_at: new Date(5_000).toISOString(),
      deleted_at: new Date(5_000).toISOString(),
    })
    await pullChanges(server)
    expect(await db.sets.get(set().id)).toBeUndefined()
  })
})

describe('sync', () => {
  it('an empty phone gets everything back from the server, exactly as it was', async () => {
    const server = new FakeServer()
    await db.sessions.add(session())
    await db.sets.add(set())
    await sync(server, USER)

    db.close()
    await Dexie.delete('gym')
    await db.open()
    await db.mesocycles.clear()
    await pullChanges(server)

    expect(await db.sessions.get(session().id)).toEqual({ ...session(), pending: 0 })
    expect(await db.sets.get(set().id)).toEqual({ ...set(), pending: 0 })
  })

  // A new database seeds the first mesocycle. After reinstalling, that seed used to go up as the
  // newest version and put the start back to 7/12.
  it("a reinstalled phone keeps the server's first mesocycle, not its own seed", async () => {
    const server = new FakeServer()
    server.write('mesocycles', `${USER}|1`, {
      number: 1,
      plan: '5d',
      start: '2026-11-14',
      updated_at: '2026-11-14T22:00:00.000Z',
    })
    await sync(server, USER)

    expect(await db.mesocycles.get(1)).toMatchObject({ start: '2026-11-14', pending: 0 })
    expect(server.table('mesocycles').get(`${USER}|1`)).toMatchObject({ start: '2026-11-14' })
  })

  it('with nothing on the server, the seeded mesocycle goes up', async () => {
    const server = new FakeServer()
    await sync(server, USER)

    expect(server.table('mesocycles').get(`${USER}|1`)).toMatchObject({
      number: 1,
      start: '2026-12-07',
    })
    expect(await db.mesocycles.get(1)).toMatchObject({ start: '2026-12-07', pending: 0 })
  })
})
