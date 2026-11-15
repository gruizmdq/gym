// Series de un ejercicio en la sesión: prellenado desde la vez anterior, lo que ya se anotó
// hoy y las cuentas de volumen. Todo puro.

export type Unidad = 'kg' | 'lb' | 'ladrillos'
export type Lado = 'izquierda' | 'derecha'
export type Carga = 'total' | 'por-mancuerna' | 'sin-carga'

export const KG_POR_LB = 0.45359237

export interface SerieRegistrada {
  indice: number
  lado: Lado | null
  peso: number | null
  unidad: Unidad
  reps: number
  cadenciaOk: boolean
  tecnicaHecha: boolean
  repsTecnica: number | null
  hecha: boolean
}

export interface Fila extends SerieRegistrada {
  // false: valor propuesto (prellenado), todavía no se tocó.
  guardada: boolean
}

export function lados(unilateral: boolean, ladoPrimero: Lado | undefined): (Lado | null)[] {
  if (!unilateral) return [null]
  const primero = ladoPrimero ?? 'izquierda'
  return [primero, primero === 'izquierda' ? 'derecha' : 'izquierda']
}

export function redondearAPaso(valor: number, paso: number): number {
  return Number((Math.round(valor / paso) * paso).toFixed(2))
}

// kg ↔ lb se convierte y se redondea al paso. Los ladrillos pesan distinto en cada máquina:
// no se convierten a nada.
export function convertirPeso(
  peso: number | null,
  de: Unidad,
  a: Unidad,
  paso: number,
): number | null {
  if (peso === null) return null
  if (de === a) return peso
  if (de === 'ladrillos' || a === 'ladrillos') return null
  return redondearAPaso(de === 'lb' ? peso * KG_POR_LB : peso / KG_POR_LB, paso)
}

export interface Prescrito {
  series: number
  repsMin: number
  unilateral: boolean
  ladoPrimero?: Lado
  unidad: Unidad
  paso: number
}

const mismaFila = (indice: number, lado: Lado | null) => (s: SerieRegistrada) =>
  s.indice === indice && s.lado === lado

export function armarFilas(
  p: Prescrito,
  anterior: SerieRegistrada[] | null,
  guardadas: SerieRegistrada[],
): Fila[] {
  const ladosDelEjercicio = lados(p.unilateral, p.ladoPrimero)
  const primerLado = ladosDelEjercicio[0] ?? null
  // Una serie agregada hoy puede superar a las prescriptas.
  const total = Math.max(p.series, ...guardadas.map((g) => g.indice))
  const filas: Fila[] = []

  for (let indice = 1; indice <= total; indice++) {
    for (const lado of ladosDelEjercicio) {
      const guardada = guardadas.find(mismaFila(indice, lado))
      if (guardada) {
        filas.push({ ...guardada, guardada: true })
        continue
      }

      const delLado = (s: SerieRegistrada) => s.lado === lado
      // Si hoy ya se tocó una serie anterior de este lado, su peso manda sobre la vez anterior.
      const previaHoy = guardadas
        .filter((g) => delLado(g) && g.indice < indice)
        .sort((a, b) => a.indice - b.indice)
        .at(-1)
      const ant = anterior?.find(mismaFila(indice, lado)) ?? anterior?.filter(delLado).at(-1)

      let peso: number | null = null
      if (previaHoy) peso = convertirPeso(previaHoy.peso, previaHoy.unidad, p.unidad, p.paso)
      else if (ant) peso = convertirPeso(ant.peso, ant.unidad, p.unidad, p.paso)

      let reps = ant?.reps ?? p.repsMin
      // Unilaterales: el segundo lado iguala las reps que hizo el primero en esa serie.
      if (lado !== primerLado) {
        const primero = guardadas.find((g) => mismaFila(indice, primerLado)(g) && g.hecha)
        if (primero) reps = primero.reps
      }

      filas.push({
        indice,
        lado,
        peso,
        unidad: p.unidad,
        reps,
        cadenciaOk: true,
        tecnicaHecha: false,
        repsTecnica: null,
        hecha: false,
        guardada: false,
      })
    }
  }
  return filas
}

export function filaActual(filas: Fila[]): Fila | null {
  return filas.find((f) => !f.hecha) ?? null
}

// El descanso arranca cuando se completa la serie entera: en unilaterales, con el segundo lado.
export function completaLaSerie(filas: Fila[], indice: number): boolean {
  return filas.filter((f) => f.indice === indice).every((f) => f.hecha)
}

// Volumen en kg. Las reps de la técnica no suman (en el drop set el peso ya no es el mismo).
export function volumen(serie: SerieRegistrada, carga: Carga): number {
  if (!serie.hecha || serie.peso === null || carga === 'sin-carga') return 0
  if (serie.unidad === 'ladrillos') return 0
  const kg = serie.unidad === 'lb' ? serie.peso * KG_POR_LB : serie.peso
  return kg * (carga === 'por-mancuerna' ? 2 : 1) * serie.reps
}
