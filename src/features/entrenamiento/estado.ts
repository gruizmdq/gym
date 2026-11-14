import type { Sesion } from '../../datos/db'
import type { FechaISO } from '../../dominio/fechas'
import { mesocicloVigente, type RegistroMesociclo } from '../../dominio/mesociclo'
import {
  avisosDelDia,
  ejercicioActivo,
  prescripcion,
  resumenSemana,
} from '../../dominio/prescripcion'
import { estadoRotacion, hoyToca, type SesionRotacion } from '../../dominio/rotacion'
import type { Dia, Plan, Rutina } from '../../rutina/schema'

// Junta el dominio con lo guardado para armar lo que muestran Hoy, la sesión y Ajustes.

export function abreviatura(dia: Dia): string {
  return dia.nombre
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
}

export function buscarPlan(rutina: Rutina, id: string): Plan {
  const plan = rutina.planes.find((p) => p.id === id) ?? rutina.planes[0]
  if (!plan) throw new Error('La rutina no tiene planes')
  return plan
}

export function buscarDia(plan: Plan, clave: string): Dia {
  const dia = plan.dias.find((d) => d.clave === clave) ?? plan.dias[0]
  if (!dia) throw new Error(`El plan ${plan.id} no tiene días`)
  return dia
}

export function diaSiguiente(plan: Plan, dia: Dia): Dia {
  const i = plan.dias.findIndex((d) => d.clave === dia.clave)
  return plan.dias[(i + 1) % plan.dias.length] ?? dia
}

export function ejerciciosDelDia(rutina: Rutina, dia: Dia, semana: number, mesociclo: number) {
  return dia.slots.map((slot) => ({ slot, ...prescripcion(rutina, slot, semana, mesociclo) }))
}

// Qué ejercicio es el principal que rota por mesociclo, si el plan tiene uno.
function principalRotativo(rutina: Rutina, plan: Plan, mesociclo: number) {
  for (const dia of plan.dias) {
    const slot = dia.slots.find((s) => s.rotacionPorMesociclo)
    if (!slot) continue
    const id = ejercicioActivo(slot, mesociclo)
    const ejercicio = rutina.ejercicios.find((e) => e.id === id)
    if (ejercicio) return { dia, ejercicio }
  }
  return null
}

export function armarEntrenamiento(
  rutina: Rutina,
  registros: RegistroMesociclo[],
  sesiones: Sesion[],
  fecha: FechaISO,
) {
  const meso = mesocicloVigente(registros, fecha, rutina.mesociclo.semanas.length)
  if (!meso) return null

  const plan = buscarPlan(rutina, meso.plan)
  const secuencia = plan.dias.map((d) => d.clave)
  const historial: SesionRotacion[] = sesiones
  const toca = hoyToca(secuencia, historial)
  const enCurso = sesiones.find((s) => s.estado === 'en-curso')

  // Una sesión en curso sigue con el plan, la semana y el mesociclo con que arrancó.
  const planDelDia = enCurso ? buscarPlan(rutina, enCurso.plan) : plan
  const dia = buscarDia(planDelDia, toca.dia)
  const semana = enCurso?.semana ?? meso.semana
  const mesociclo = enCurso?.mesociclo ?? meso.numero
  const ejercicios = ejerciciosDelDia(rutina, dia, semana, mesociclo)

  const ultima = sesiones
    .filter((s) => s.dia === dia.clave && s.estado === 'terminada' && s.finalizadaEn)
    .sort((a, b) => b.orden - a.orden)[0]

  return {
    meso,
    plan,
    dia,
    continuar: toca.continuar,
    sesionEnCurso: enCurso,
    semana: resumenSemana(rutina, semana, mesociclo),
    ejercicios,
    seriesTotales: ejercicios.reduce((total, e) => total + e.series, 0),
    avisos: avisosDelDia(dia, semana),
    rotacion: estadoRotacion(secuencia, historial).map((r) => ({
      ...r,
      dia: buscarDia(plan, r.dia),
    })),
    siguiente: diaSiguiente(planDelDia, dia),
    ultimaDuracion: ultima?.finalizadaEn ? ultima.finalizadaEn - ultima.iniciadaEn : null,
    // El plan se cambia al empezar un mesociclo, hasta su primera sesión.
    puedeCambiarPlan: !sesiones.some(
      (s) => s.mesociclo === meso.numero && s.estado !== 'descartada',
    ),
    principal: principalRotativo(rutina, plan, meso.numero),
  }
}

export type Entrenamiento = NonNullable<ReturnType<typeof armarEntrenamiento>>
