import type { AjusteEjercicio, Serie, Sesion } from '../../datos/db'
import { ejercicioActivo, prescripcion, semanaDe } from '../../dominio/prescripcion'
import { type Lado, lados, type Unidad } from '../../dominio/series'
import { firma } from '../../dominio/vezAnterior'
import type { Dia, Ejercicio, Rutina, Slot } from '../../rutina/schema'
import { buscarDia, buscarPlan } from '../entrenamiento/estado'

// Lo que la sesión en curso necesita saber de cada slot: qué ejercicio se está haciendo,
// cómo se anota y cuánto falta.
export interface SlotEnSesion {
  slot: Slot
  ejercicio: Ejercicio
  opciones: Ejercicio[]
  series: number
  reps: { min: number; max: number }
  rir: { min: number; max: number } | null
  tecnica: ReturnType<typeof prescripcion>['tecnica']
  unidad: Unidad
  paso: number
  firma: string
  lados: (Lado | null)[]
  guardadas: Serie[]
  seriesHechas: number
  salteado: boolean
}

export function ejercicioPorId(rutina: Rutina, id: string): Ejercicio {
  const e = rutina.ejercicios.find((x) => x.id === id)
  if (!e) throw new Error(`No existe el ejercicio ${id}`)
  return e
}

export function ajusteDe(ejercicio: Ejercicio, ajustes: Map<string, AjusteEjercicio>) {
  const a = ajustes.get(ejercicio.id)
  return a ?? { unidad: 'kg' as const, paso: ejercicio.incremento ?? 2.5 }
}

export function diaDeSesion(rutina: Rutina, sesion: Sesion): Dia {
  return buscarDia(buscarPlan(rutina, sesion.plan), sesion.dia)
}

export function slotsDeSesion(
  rutina: Rutina,
  sesion: Sesion,
  series: Serie[],
  ajustes: Map<string, AjusteEjercicio>,
): SlotEnSesion[] {
  const dia = diaDeSesion(rutina, sesion)
  const semana = semanaDe(rutina, sesion.semana)

  return dia.slots.map((slot) => {
    const p = prescripcion(rutina, slot, sesion.semana, sesion.mesociclo)
    const deRutina = ejercicioActivo(slot, sesion.mesociclo)
    const ejercicio = ejercicioPorId(rutina, sesion.elegidos?.[slot.id] ?? deRutina)
    const opciones = [deRutina, ...(slot.alternativas ?? [])].map((id) =>
      ejercicioPorId(rutina, id),
    )
    const { unidad, paso } = ajusteDe(ejercicio, ajustes)
    const ladosDelEjercicio = lados(ejercicio.unilateral, slot.ladoPrimero)
    const guardadas = series.filter((s) => s.slotId === slot.id && s.ejercicioId === ejercicio.id)
    const total = p.series + (sesion.extras?.[slot.id] ?? 0)
    // Una serie unilateral cuenta cuando están hechos los dos lados.
    let seriesHechas = 0
    for (let i = 1; i <= Math.max(total, ...guardadas.map((g) => g.indice)); i++) {
      const filas = guardadas.filter((g) => g.indice === i && g.hecha)
      if (filas.length >= ladosDelEjercicio.length) seriesHechas += 1
    }

    return {
      slot,
      ejercicio,
      opciones,
      series: Math.max(total, ...guardadas.map((g) => g.indice)),
      reps: p.reps,
      // La alternativa elegida manda en la categoría (compuesto o aislamiento).
      rir: semana.rir?.[ejercicio.categoria] ?? null,
      tecnica: p.tecnica,
      unidad,
      paso,
      firma: firma(dia.clave, ejercicio.id, slot),
      lados: ladosDelEjercicio,
      guardadas,
      seriesHechas,
      salteado: sesion.salteados?.includes(slot.id) ?? false,
    }
  })
}

export const pendiente = (s: SlotEnSesion) => !s.salteado && s.seriesHechas < s.series

// El próximo ejercicio con series por hacer, empezando por el que sigue al actual.
export function siguienteSlot(slots: SlotEnSesion[], actualId?: string): SlotEnSesion | null {
  const i = slots.findIndex((s) => s.slot.id === actualId)
  const orden = [...slots.slice(i + 1), ...slots.slice(0, Math.max(i, 0))]
  return orden.find(pendiente) ?? null
}
