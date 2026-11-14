import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Serie, type Sesion } from '../datos/db'
import { bajarCambios, type Remoto, resolver, sincronizar, subirPendientes } from './motor'
import type { FilaRemota } from './tablas'

const USUARIO = '00000000-0000-0000-0000-000000000001'

// Servidor en memoria con las mismas reglas que el trigger de Postgres: cada escritura toma
// la siguiente secuencia y una versión más vieja que la guardada se ignora.
class ServidorFalso implements Remoto {
  tablas = new Map<string, Map<string, FilaRemota>>()
  secuencia = 0
  falla = false
  mientrasSube: ((tabla: string) => Promise<void>) | null = null

  tabla(nombre: string) {
    let t = this.tablas.get(nombre)
    if (!t) {
      t = new Map()
      this.tablas.set(nombre, t)
    }
    return t
  }

  async subir(tabla: string, filas: FilaRemota[], conflicto: string) {
    if (this.falla) throw new Error('Sin señal')
    const t = this.tabla(tabla)
    for (const fila of filas) {
      const clave = conflicto
        .split(',')
        .map((c) => fila[c])
        .join('|')
      const previa = t.get(clave)
      if (
        previa &&
        Date.parse(String(fila.actualizado_en)) < Date.parse(String(previa.actualizado_en))
      )
        continue
      t.set(clave, { eliminado_en: null, ...fila, secuencia: ++this.secuencia })
    }
    await this.mientrasSube?.(tabla)
  }

  async bajar(tabla: string, desde: number, limite: number) {
    return [...this.tabla(tabla).values()]
      .filter((f) => Number(f.secuencia) > desde)
      .sort((a, b) => Number(a.secuencia) - Number(b.secuencia))
      .slice(0, limite)
  }

  escribir(tabla: string, clave: string, fila: FilaRemota) {
    this.tabla(tabla).set(clave, {
      user_id: USUARIO,
      eliminado_en: null,
      ...fila,
      secuencia: ++this.secuencia,
    })
  }
}

function sesion(extra: Partial<Sesion> = {}): Sesion {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    plan: '5d',
    dia: 'lower-a',
    fecha: '2026-12-07',
    estado: 'terminada',
    mesociclo: 1,
    semana: 1,
    descarga: false,
    versionRutina: 'abc',
    iniciadaEn: 1_000,
    finalizadaEn: 4_000,
    orden: 4_000,
    elegidos: { prensa: 'hack' },
    extras: {},
    salteados: ['crunch'],
    descanso: null,
    notas: 'Dormí poco',
    actualizadoEn: 4_000,
    pendiente: 1,
    ...extra,
  }
}

function serie(extra: Partial<Serie> = {}): Serie {
  return {
    id: '11111111-1111-1111-1111-111111111111:prensa:hack:1:-',
    sesionId: '11111111-1111-1111-1111-111111111111',
    slotId: 'prensa',
    ejercicioId: 'hack',
    firma: 'lower-a|hack|10-12|2-0-1-0|RP',
    indice: 1,
    lado: null,
    peso: 112.5,
    unidad: 'kg',
    reps: 12,
    cadenciaOk: true,
    tecnicaHecha: false,
    repsTecnica: null,
    hecha: true,
    actualizadoEn: 3_000,
    pendiente: 1,
    ...extra,
  }
}

beforeEach(async () => {
  db.close()
  await Dexie.delete('gym')
  await db.open()
})

describe('resolver: qué pasa con una fila que llega del servidor', () => {
  it.each<[string, Parameters<typeof resolver>[0], Parameters<typeof resolver>[1], string]>([
    ['no existe en el teléfono', undefined, { actualizadoEn: 5, eliminada: false }, 'guardar'],
    [
      'sin cambios propios',
      { actualizadoEn: 9, pendiente: 0 },
      { actualizadoEn: 5, eliminada: false },
      'guardar',
    ],
    [
      'cambio propio más nuevo',
      { actualizadoEn: 9, pendiente: 1 },
      { actualizadoEn: 5, eliminada: false },
      'mantener',
    ],
    [
      'cambio propio más viejo',
      { actualizadoEn: 5, pendiente: 1 },
      { actualizadoEn: 9, eliminada: false },
      'guardar',
    ],
    [
      'eco de lo que ya subimos',
      { actualizadoEn: 5, pendiente: 1 },
      { actualizadoEn: 5, eliminada: false },
      'guardar',
    ],
    [
      'llega borrada',
      { actualizadoEn: 9, pendiente: 1 },
      { actualizadoEn: 5, eliminada: true },
      'borrar',
    ],
  ])('%s → %s', (_caso, local, remota, esperado) => {
    expect(resolver(local, remota)).toBe(esperado)
  })
})

describe('subirPendientes', () => {
  it('sube lo pendiente y lo deja al día', async () => {
    const servidor = new ServidorFalso()
    await db.sesiones.add(sesion())
    await db.series.add(serie())
    await subirPendientes(servidor, USUARIO)
    expect(servidor.tabla('series').size).toBe(1)
    expect(servidor.tabla('sesiones').size).toBe(1)
    expect((await db.series.get(serie().id))?.pendiente).toBe(0)
  })

  it('si la fila cambia mientras sube, queda pendiente para el próximo envío', async () => {
    const servidor = new ServidorFalso()
    await db.sesiones.add(sesion())
    await db.series.add(serie())
    servidor.mientrasSube = async (tabla) => {
      if (tabla !== 'series') return
      await db.series.update(serie().id, { reps: 13, actualizadoEn: 9_000, pendiente: 1 })
    }
    await subirPendientes(servidor, USUARIO)
    expect(await db.series.get(serie().id)).toMatchObject({ reps: 13, pendiente: 1 })
  })

  it('si falla (sin señal), todo sigue pendiente', async () => {
    const servidor = new ServidorFalso()
    servidor.falla = true
    await db.series.add(serie())
    await expect(subirPendientes(servidor, USUARIO)).rejects.toThrow('Sin señal')
    expect((await db.series.get(serie().id))?.pendiente).toBe(1)
  })

  it('sube las sesiones antes que sus series', async () => {
    const orden: string[] = []
    const servidor = new ServidorFalso()
    const subir = servidor.subir.bind(servidor)
    servidor.subir = async (tabla, filas, conflicto) => {
      orden.push(tabla)
      await subir(tabla, filas, conflicto)
    }
    await db.series.add(serie())
    await db.sesiones.add(sesion())
    await subirPendientes(servidor, USUARIO)
    expect(orden.indexOf('sesiones')).toBeLessThan(orden.indexOf('series'))
  })
})

describe('bajarCambios', () => {
  it('trae lo nuevo de a páginas y guarda el cursor', async () => {
    const servidor = new ServidorFalso()
    for (const n of [2, 3, 4]) {
      servidor.escribir('mesociclos', String(n), {
        numero: n,
        plan: '5d',
        inicio: '2027-01-18',
        actualizado_en: new Date(1_000).toISOString(),
      })
    }
    await bajarCambios(servidor, 2)
    expect((await db.mesociclos.toArray()).map((m) => m.numero).sort()).toEqual([1, 2, 3, 4])
    expect((await db.meta.get('cursor:mesociclos'))?.valor).toBe(3)
  })

  it('no pisa un cambio del teléfono más nuevo que el del servidor', async () => {
    const servidor = new ServidorFalso()
    await db.mesociclos.put({
      numero: 1,
      plan: '4d',
      inicio: '2026-12-07',
      actualizadoEn: 9_000,
      pendiente: 1,
    })
    servidor.escribir('mesociclos', '1', {
      numero: 1,
      plan: '5d',
      inicio: '2026-12-07',
      actualizado_en: new Date(5_000).toISOString(),
    })
    await bajarCambios(servidor)
    expect(await db.mesociclos.get(1)).toMatchObject({ plan: '4d', pendiente: 1 })
  })

  it('borra en el teléfono lo que llega borrado', async () => {
    const servidor = new ServidorFalso()
    await db.series.put({ ...serie(), pendiente: 0 })
    servidor.escribir('series', serie().id, {
      id: serie().id,
      actualizado_en: new Date(5_000).toISOString(),
      eliminado_en: new Date(5_000).toISOString(),
    })
    await bajarCambios(servidor)
    expect(await db.series.get(serie().id)).toBeUndefined()
  })
})

describe('sincronizar', () => {
  it('un teléfono vacío recupera todo desde el servidor, igual que estaba', async () => {
    const servidor = new ServidorFalso()
    await db.sesiones.add(sesion())
    await db.series.add(serie())
    await sincronizar(servidor, USUARIO)

    db.close()
    await Dexie.delete('gym')
    await db.open()
    await db.mesociclos.clear()
    await bajarCambios(servidor)

    expect(await db.sesiones.get(sesion().id)).toEqual({ ...sesion(), pendiente: 0 })
    expect(await db.series.get(serie().id)).toEqual({ ...serie(), pendiente: 0 })
  })
})

describe('migración de Dexie a la versión 3', () => {
  it('lo anotado antes de la fase 4 queda pendiente de subir', async () => {
    db.close()
    await Dexie.delete('gym')
    const vieja = new Dexie('gym')
    vieja
      .version(1)
      .stores({ mesociclos: 'numero', sesiones: 'id, fecha, estado', rutinas: 'version' })
    vieja
      .version(2)
      .stores({ series: 'id, sesionId, ejercicioId', ajustesEjercicio: 'ejercicioId' })
    await vieja.open()
    const { actualizadoEn: _a, pendiente: _p, ...anterior } = serie()
    await vieja.table('series').add({ ...anterior, actualizadaEn: 123 })
    await vieja.table('mesociclos').add({ numero: 1, plan: '5d', inicio: '2026-12-07' })
    vieja.close()

    await db.open()
    const migrada = await db.series.get(serie().id)
    expect(migrada).toMatchObject({ actualizadoEn: 123, pendiente: 1 })
    expect(migrada).not.toHaveProperty('actualizadaEn')
    expect((await db.mesociclos.get(1))?.pendiente).toBe(1)
  })
})
