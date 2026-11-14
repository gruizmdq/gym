import { db, type Sincronizable } from '../datos/db'
import { type DefinicionTabla, type FilaRemota, TABLAS } from './tablas'

// Lo que el motor necesita del servidor. En la app es Supabase; en los tests, un doble en memoria.
export interface Remoto {
  subir(tabla: string, filas: FilaRemota[], conflicto: string): Promise<void>
  bajar(tabla: string, desde: number, limite: number): Promise<FilaRemota[]>
}

export type Decision = 'guardar' | 'mantener' | 'borrar'

// Qué hacer con una fila que llega del servidor (tabla de casos de la fase 4).
export function resolver(
  local: Sincronizable | undefined,
  remota: { actualizadoEn: number; eliminada: boolean },
): Decision {
  if (remota.eliminada) return 'borrar'
  if (!local || local.pendiente === 0) return 'guardar'
  // Con un cambio sin subir, gana el más nuevo. Igual = es el eco de lo que ya subimos.
  return local.actualizadoEn > remota.actualizadoEn ? 'mantener' : 'guardar'
}

const LOTE_SUBIDA = 500
const LOTE_BAJADA = 1000

function lotes<T>(filas: T[], tamanio: number): T[][] {
  const res: T[][] = []
  for (let i = 0; i < filas.length; i += tamanio) res.push(filas.slice(i, i + tamanio))
  return res
}

// biome-ignore lint/suspicious/noExplicitAny: cada tabla tiene su tipo; acá se recorren juntas.
type Cualquiera = DefinicionTabla<any>

async function subirTabla(def: Cualquiera, remoto: Remoto, userId: string): Promise<void> {
  const tabla = db.table(def.local)
  const pendientes: Sincronizable[] = await tabla.where('pendiente').equals(1).toArray()
  for (const lote of lotes(pendientes, LOTE_SUBIDA)) {
    await remoto.subir(
      def.remota,
      lote.map((f) => def.aRemota(f, userId)),
      def.conflicto,
    )
    // Si la fila cambió mientras subía, queda pendiente: la versión nueva sale en el próximo envío.
    await db.transaction('rw', tabla, async () => {
      for (const subida of lote) {
        const clave = def.claveLocal(subida)
        const actual: Sincronizable | undefined = await tabla.get(clave)
        if (actual && actual.actualizadoEn === subida.actualizadoEn) {
          await tabla.update(clave, { pendiente: 0 })
        }
      }
    })
  }
}

async function bajarTabla(def: Cualquiera, remoto: Remoto, limite: number): Promise<void> {
  const tabla = db.table(def.local)
  const claveCursor = `cursor:${def.remota}`
  let cursor = (await db.meta.get(claveCursor))?.valor ?? 0

  for (;;) {
    const filas = await remoto.bajar(def.remota, cursor, limite)
    if (!filas.length) return
    await db.transaction('rw', tabla, db.meta, async () => {
      for (const remota of filas) {
        const clave = def.claveRemota(remota)
        const decision = resolver(await tabla.get(clave), {
          actualizadoEn: Date.parse(String(remota.actualizado_en)),
          eliminada: remota.eliminado_en !== null && remota.eliminado_en !== undefined,
        })
        if (decision === 'borrar') await tabla.delete(clave)
        if (decision === 'guardar') await tabla.put(def.aLocal(remota))
      }
      cursor = Number(filas.at(-1)?.secuencia ?? cursor)
      await db.meta.put({ clave: claveCursor, valor: cursor })
    })
    if (filas.length < limite) return
  }
}

export async function subirPendientes(remoto: Remoto, userId: string): Promise<void> {
  for (const def of TABLAS) await subirTabla(def, remoto, userId)
}

export async function bajarCambios(remoto: Remoto, limite = LOTE_BAJADA): Promise<void> {
  for (const def of TABLAS) await bajarTabla(def, remoto, limite)
}

export async function sincronizar(remoto: Remoto, userId: string): Promise<void> {
  await subirPendientes(remoto, userId)
  await bajarCambios(remoto)
}

export async function contarPendientes(): Promise<number> {
  const cuentas = await Promise.all(
    TABLAS.map((def) => db.table(def.local).where('pendiente').equals(1).count()),
  )
  return cuentas.reduce((a, b) => a + b, 0)
}
