import type { Dia, Ejercicio, Rutina, Semana, Slot } from '../rutina/schema'

export interface Rir {
  min: number
  max: number
}

export interface Prescripcion {
  ejercicio: Ejercicio
  series: number
  reps: { min: number; max: number }
  rir: Rir | null
  // null: el slot no tiene técnica. desdeSemana: primera semana de este mesociclo en la que
  // aplica, si todavía no llegó.
  tecnica: {
    tipo: NonNullable<Slot['tecnica']>
    aplica: boolean
    desdeSemana: number | null
  } | null
}

export function semanaDe(rutina: Rutina, numero: number): Semana {
  const semana = rutina.mesociclo.semanas[numero - 1]
  if (!semana) throw new Error(`La rutina no tiene la semana ${numero}`)
  return semana
}

function hayTecnicas(semana: Semana, mesociclo: number): boolean {
  return semana.tecnicasDesdeMesociclo !== null && mesociclo >= semana.tecnicasDesdeMesociclo
}

export function resumenSemana(rutina: Rutina, numero: number, mesociclo: number) {
  const semana = semanaDe(rutina, numero)
  return {
    semana: numero,
    nombre: semana.nombre,
    descarga: semana.descarga,
    rir: semana.rir ?? null,
    tecnicas: hayTecnicas(semana, mesociclo),
    nota: semana.nota,
  }
}

export function ejercicioActivo(slot: Slot, mesociclo: number): string {
  const rotacion = slot.rotacionPorMesociclo
  if (!rotacion) return slot.ejercicio
  return rotacion[(mesociclo - 1) % rotacion.length] ?? slot.ejercicio
}

export function prescripcion(
  rutina: Rutina,
  slot: Slot,
  numeroSemana: number,
  mesociclo: number,
): Prescripcion {
  const id = ejercicioActivo(slot, mesociclo)
  const ejercicio = rutina.ejercicios.find((e) => e.id === id)
  if (!ejercicio) throw new Error(`No existe el ejercicio ${id}`)

  const semana = semanaDe(rutina, numeroSemana)
  let tecnica: Prescripcion['tecnica'] = null
  if (slot.tecnica) {
    const aplica = hayTecnicas(semana, mesociclo)
    const proxima = rutina.mesociclo.semanas.find(
      (s) => s.semana > numeroSemana && hayTecnicas(s, mesociclo),
    )
    tecnica = {
      tipo: slot.tecnica,
      aplica,
      desdeSemana: aplica || semana.descarga ? null : (proxima?.semana ?? null),
    }
  }

  return {
    ejercicio,
    // Descarga: mismas cargas, mitad de las series, redondeando para arriba.
    series: semana.descarga ? Math.ceil(slot.series / 2) : slot.series,
    reps: slot.reps,
    rir: semana.rir?.[ejercicio.categoria] ?? null,
    tecnica,
  }
}

export function avisosDelDia(dia: Dia, numeroSemana: number): string[] {
  return (dia.avisos ?? []).filter((a) => a.semanas.includes(numeroSemana)).map((a) => a.texto)
}
