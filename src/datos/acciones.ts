import json from '../../rutina/rutina.json'
import { type FechaISO, fechaISO } from '../dominio/fechas'
import {
  arrancarAntes,
  cambiarInicio,
  cambiarPlan,
  cambiarSemana,
  mesocicloVigente,
  type RegistroMesociclo,
} from '../dominio/mesociclo'
import { semanaDe } from '../dominio/prescripcion'
import type { SerieRegistrada, Unidad } from '../dominio/series'
import { rutina } from '../rutina/rutina'
import { db, idSerie, type Sesion } from './db'

// Toda escritura pasa por acá: cada toque queda en IndexedDB al instante.

const SEMANAS = rutina.mesociclo.semanas.length

const hoy = () => fechaISO(new Date())

export async function registrarVersionRutina(): Promise<void> {
  if (await db.rutinas.get(__VERSION_RUTINA__)) return
  await db.rutinas.put({ version: __VERSION_RUTINA__, contenido: json, vistaEn: Date.now() })
}

async function nuevaSesion(plan: string, dia: string, estado: Sesion['estado']): Promise<string> {
  const ahora = Date.now()
  const fecha = fechaISO(new Date(ahora))
  const meso = mesocicloVigente(await db.mesociclos.toArray(), fecha, SEMANAS)
  if (!meso) throw new Error('No hay ningún mesociclo configurado')
  const id = crypto.randomUUID()
  await db.sesiones.add({
    id,
    plan,
    dia,
    fecha,
    estado,
    mesociclo: meso.numero,
    semana: meso.semana,
    descarga: semanaDe(rutina, meso.semana).descarga,
    versionRutina: __VERSION_RUTINA__,
    iniciadaEn: ahora,
    ...(estado === 'salteada' ? { finalizadaEn: ahora } : {}),
    orden: ahora,
  })
  return id
}

export function empezarSesion(plan: string, dia: string): Promise<string> {
  return db.transaction('rw', db.sesiones, db.mesociclos, async () => {
    const enCurso = await db.sesiones.where('estado').equals('en-curso').first()
    return enCurso ? enCurso.id : nuevaSesion(plan, dia, 'en-curso')
  })
}

export async function saltearDia(plan: string, dia: string): Promise<void> {
  await db.transaction('rw', db.sesiones, db.mesociclos, () => nuevaSesion(plan, dia, 'salteada'))
}

async function reemplazarMesociclos(registros: RegistroMesociclo[]): Promise<void> {
  await db.mesociclos.clear()
  await db.mesociclos.bulkPut(registros)
}

export async function terminarSesion(id: string): Promise<void> {
  await db.transaction('rw', db.sesiones, db.mesociclos, async () => {
    const sesion = await db.sesiones.get(id)
    if (!sesion) return
    const ahora = Date.now()
    await db.sesiones.update(id, {
      estado: 'terminada',
      finalizadaEn: ahora,
      orden: ahora,
      descanso: null,
    })
    const registros = await db.mesociclos.toArray()
    const nuevos = arrancarAntes(registros, sesion.fecha, SEMANAS)
    if (nuevos !== registros) await reemplazarMesociclos(nuevos)
  })
}

export async function descartarSesion(id: string): Promise<void> {
  await db.sesiones.update(id, { estado: 'descartada', orden: Date.now() })
}

async function ajustarMesociclos(
  cambio: (registros: RegistroMesociclo[], fecha: FechaISO) => RegistroMesociclo[],
): Promise<void> {
  await db.transaction('rw', db.mesociclos, async () => {
    const registros = await db.mesociclos.toArray()
    const nuevos = cambio(registros, hoy())
    if (nuevos !== registros) await reemplazarMesociclos(nuevos)
  })
}

export function cambiarSemanaActual(semana: number): Promise<void> {
  return ajustarMesociclos((r, f) => cambiarSemana(r, f, semana, SEMANAS))
}

export function cambiarPlanActual(plan: string): Promise<void> {
  return ajustarMesociclos((r, f) => cambiarPlan(r, f, plan, SEMANAS))
}

export function cambiarInicioActual(inicio: FechaISO): Promise<void> {
  return ajustarMesociclos((r, f) => cambiarInicio(r, f, inicio, SEMANAS))
}

// --- Sesión en curso -------------------------------------------------------------------------

export interface DondeAnotar {
  sesionId: string
  slotId: string
  ejercicioId: string
  firma: string
}

function aSerie(d: DondeAnotar, fila: SerieRegistrada) {
  return {
    id: idSerie(d.sesionId, d.slotId, d.ejercicioId, fila.indice, fila.lado),
    sesionId: d.sesionId,
    slotId: d.slotId,
    ejercicioId: d.ejercicioId,
    firma: d.firma,
    indice: fila.indice,
    lado: fila.lado,
    peso: fila.peso,
    unidad: fila.unidad,
    reps: fila.reps,
    cadenciaOk: fila.cadenciaOk,
    tecnicaHecha: fila.tecnicaHecha,
    repsTecnica: fila.repsTecnica,
    hecha: fila.hecha,
    actualizadaEn: Date.now(),
  }
}

export async function guardarFila(d: DondeAnotar, fila: SerieRegistrada): Promise<void> {
  await db.series.put(aSerie(d, fila))
}

// Completar una serie la guarda y, si cierra la serie (en unilaterales, con el segundo lado),
// arranca el descanso del slot.
export async function completarFila(
  d: DondeAnotar,
  fila: SerieRegistrada,
  descansoSegundos: number | null,
): Promise<void> {
  await db.transaction('rw', db.series, db.sesiones, async () => {
    await db.series.put(aSerie(d, { ...fila, hecha: true }))
    if (descansoSegundos !== null) {
      const total = descansoSegundos * 1000
      await db.sesiones.update(d.sesionId, {
        descanso: { slotId: d.slotId, terminaEn: Date.now() + total, total },
      })
    }
  })
}

async function modificarSesion(id: string, cambio: (s: Sesion) => void): Promise<void> {
  await db.sesiones.where('id').equals(id).modify(cambio)
}

export function sumarDescanso(sesionId: string, ms: number): Promise<void> {
  return modificarSesion(sesionId, (s) => {
    if (!s.descanso) return
    // Nunca deja el descanso terminado de golpe al restar: queda al menos un segundo.
    const terminaEn = Math.max(Date.now() + 1000, s.descanso.terminaEn + ms)
    s.descanso = {
      ...s.descanso,
      terminaEn,
      total: Math.max(s.descanso.total, terminaEn - Date.now()),
    }
  })
}

export async function terminarDescanso(sesionId: string): Promise<void> {
  await db.sesiones.update(sesionId, { descanso: null })
}

export function elegirEjercicio(
  sesionId: string,
  slotId: string,
  ejercicioId: string,
): Promise<void> {
  return modificarSesion(sesionId, (s) => {
    s.elegidos = { ...s.elegidos, [slotId]: ejercicioId }
  })
}

export function agregarSerie(sesionId: string, slotId: string): Promise<void> {
  return modificarSesion(sesionId, (s) => {
    s.extras = { ...s.extras, [slotId]: (s.extras?.[slotId] ?? 0) + 1 }
  })
}

export function saltearEjercicio(sesionId: string, slotId: string): Promise<void> {
  return modificarSesion(sesionId, (s) => {
    s.salteados = [...new Set([...(s.salteados ?? []), slotId])]
  })
}

export function retomarEjercicio(sesionId: string, slotId: string): Promise<void> {
  return modificarSesion(sesionId, (s) => {
    s.salteados = (s.salteados ?? []).filter((x) => x !== slotId)
  })
}

export async function guardarNotas(sesionId: string, notas: string): Promise<void> {
  await db.sesiones.update(sesionId, { notas })
}

export async function configurarEjercicio(
  ejercicioId: string,
  unidad: Unidad,
  paso: number,
): Promise<void> {
  await db.ajustesEjercicio.put({ ejercicioId, unidad, paso })
}
