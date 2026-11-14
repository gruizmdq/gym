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
import { rutina } from '../rutina/rutina'
import { db, type Sesion } from './db'

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
    await db.sesiones.update(id, { estado: 'terminada', finalizadaEn: ahora, orden: ahora })
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
