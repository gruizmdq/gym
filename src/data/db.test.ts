import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, INITIAL_MESOCYCLE } from './db'

beforeEach(async () => {
  db.close()
  await Dexie.delete('gym')
})

describe('opening the database', () => {
  it('a brand-new database starts with the first mesocycle, once', async () => {
    await db.open()
    expect(await db.mesocycles.toArray()).toEqual([
      expect.objectContaining({ ...INITIAL_MESOCYCLE, pending: 1 }),
    ])
  })

  it('a phone with the Spanish version 3 opens it, drops the old tables and gets the first mesocycle', async () => {
    // The schema phones had before the code went English: same name, `meta` keyed by `clave`.
    const old = new Dexie('gym')
    old.version(3).stores({
      mesociclos: 'numero, pendiente',
      sesiones: 'id, fecha, estado, pendiente',
      rutinas: 'version, pendiente',
      series: 'id, sesionId, ejercicioId, pendiente',
      ajustesEjercicio: 'ejercicioId, pendiente',
      meta: 'clave',
    })
    await old.open()
    await old.table('mesociclos').add({ numero: 1, plan: '5d', inicio: '2026-12-07' })
    await old.table('meta').add({ clave: 'ultimaSync', valor: 1 })
    old.close()

    await db.open()
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'circumferences',
      'exerciseSettings',
      'mesocycles',
      'meta',
      'routines',
      'sessions',
      'sets',
      'waists',
      'weights',
    ])
    expect(await db.mesocycles.toArray()).toEqual([
      expect.objectContaining({ ...INITIAL_MESOCYCLE, pending: 1 }),
    ])
    expect(await db.meta.count()).toBe(0)
  })
})
