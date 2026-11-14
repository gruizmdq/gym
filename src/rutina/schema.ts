import { z } from 'zod'

// Forma de rutina/rutina.json. La rutina es un dato: Claude la edita, el test la valida y,
// si no valida, no hay deploy. Las reglas que cruzan partes del archivo están en superRefine.

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones')

const EjercicioSchema = z.strictObject({
  id,
  nombre: z.string().min(1),
  detalle: z.string().min(1).optional(),
  equipo: z.enum(['maquina', 'polea', 'barra', 'mancuernas', 'peso-corporal']),
  categoria: z.enum(['compuesto', 'aislamiento']),
  unilateral: z.boolean().default(false),
  // Cómo se anota la carga: total de la máquina o barra, por mancuerna o sin carga (solo reps).
  carga: z.enum(['total', 'por-mancuerna', 'sin-carga']).default('total'),
  // Paso por defecto en kg. La unidad y el paso reales se ajustan por ejercicio en la app.
  incremento: z.number().positive().optional(),
})

const SlotSchema = z.strictObject({
  id,
  ejercicio: id,
  // El ejercicio activo alterna por mesociclo: [impar, par, ...]. El primero es `ejercicio`.
  rotacionPorMesociclo: z.array(id).min(2).optional(),
  series: z.number().int().min(1),
  reps: z.strictObject({ min: z.number().int().min(1), max: z.number().int().min(1) }),
  descanso: z.number().int().min(15).describe('Segundos'),
  cadencia: z.string().regex(/^\d-\d-\d-\d$|^lenta$/, 'Formato 2-1-1-0 o "lenta"'),
  // Si está, hay pausa en estiramiento y el texto dice en qué posición.
  pausa: z.string().min(1).optional(),
  tecnica: z.enum(['RP', 'DS', 'PE']).optional(),
  ladoPrimero: z.enum(['izquierda', 'derecha']).optional(),
  alternativas: z.array(id).optional(),
  nota: z.string().min(1).optional(),
})

const AvisoSchema = z.strictObject({
  semanas: z.array(z.number().int().min(1)).min(1),
  texto: z.string().min(1),
})

const DiaSchema = z.strictObject({
  // Compartida entre planes: Lower A del plan de 5 y del de 4 días son el mismo contexto.
  clave: id,
  nombre: z.string().min(1),
  foco: z.string().min(1),
  salteable: z.boolean().default(false),
  avisos: z.array(AvisoSchema).optional(),
  slots: z.array(SlotSchema).min(1),
})

const PlanSchema = z.strictObject({
  id,
  nombre: z.string().min(1),
  dias: z.array(DiaSchema).min(1),
})

const RirSchema = z.strictObject({ min: z.number().int().min(0), max: z.number().int().min(0) })

const SemanaSchema = z.strictObject({
  semana: z.number().int().min(1),
  nombre: z.string().min(1).optional(),
  // Sin RIR en la descarga: se usan las mismas cargas con la mitad de las series.
  rir: z.strictObject({ compuesto: RirSchema, aislamiento: RirSchema }).optional(),
  // Número de mesociclo desde el que hay técnicas esa semana; null = no hay.
  tecnicasDesdeMesociclo: z.number().int().min(1).nullable(),
  descarga: z.boolean().default(false),
})

export const RutinaSchema = z
  .strictObject({
    nombre: z.string().min(1),
    ejercicios: z.array(EjercicioSchema).min(1),
    planes: z.array(PlanSchema).min(1),
    mesociclo: z.strictObject({ semanas: z.array(SemanaSchema).min(1) }),
  })
  .superRefine((rutina, ctx) => {
    const error = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })

    const ejercicios = new Map<string, z.infer<typeof EjercicioSchema>>()
    rutina.ejercicios.forEach((e, i) => {
      if (ejercicios.has(e.id)) error(['ejercicios', i, 'id'], `Ejercicio repetido: ${e.id}`)
      ejercicios.set(e.id, e)
    })

    const repetidos = (ids: string[]) => ids.filter((x, i) => ids.indexOf(x) !== i)

    for (const r of repetidos(rutina.planes.map((p) => p.id))) {
      error(['planes'], `Plan repetido: ${r}`)
    }

    rutina.planes.forEach((plan, p) => {
      for (const r of repetidos(plan.dias.map((d) => d.clave))) {
        error(['planes', p, 'dias'], `Día repetido en ${plan.id}: ${r}`)
      }

      plan.dias.forEach((dia, d) => {
        for (const r of repetidos(dia.slots.map((s) => s.id))) {
          error(['planes', p, 'dias', d, 'slots'], `Slot repetido en ${dia.clave}: ${r}`)
        }

        dia.slots.forEach((slot, s) => {
          const path = ['planes', p, 'dias', d, 'slots', s]
          const ref = (campo: string, valor: string) => {
            if (!ejercicios.has(valor)) {
              error([...path, campo], `${dia.clave}.${slot.id}: no existe el ejercicio ${valor}`)
            }
          }
          ref('ejercicio', slot.ejercicio)
          for (const a of slot.alternativas ?? []) ref('alternativas', a)
          for (const r of slot.rotacionPorMesociclo ?? []) ref('rotacionPorMesociclo', r)

          if (slot.reps.min > slot.reps.max) {
            error([...path, 'reps'], `${dia.clave}.${slot.id}: el mínimo de reps supera al máximo`)
          }

          if (slot.rotacionPorMesociclo && slot.rotacionPorMesociclo[0] !== slot.ejercicio) {
            error(
              [...path, 'rotacionPorMesociclo'],
              `${dia.clave}.${slot.id}: la rotación tiene que empezar por ${slot.ejercicio}`,
            )
          }

          const ejercicio = ejercicios.get(slot.ejercicio)
          if (!ejercicio) return

          if (ejercicio.unilateral && !slot.ladoPrimero) {
            error([...path, 'ladoPrimero'], `${dia.clave}.${slot.id}: falta el lado que va primero`)
          }
          if (!ejercicio.unilateral && slot.ladoPrimero) {
            error(
              [...path, 'ladoPrimero'],
              `${dia.clave}.${slot.id}: ladoPrimero solo va en unilaterales`,
            )
          }

          // Regla de la rutina: las técnicas nunca van en compuestos con peso libre.
          const pesoLibre = ejercicio.equipo === 'barra' || ejercicio.equipo === 'mancuernas'
          if (slot.tecnica && ejercicio.categoria === 'compuesto' && pesoLibre) {
            error(
              [...path, 'tecnica'],
              `${dia.clave}.${slot.id}: no va técnica en un compuesto con peso libre`,
            )
          }
        })
      })
    })

    const numeros = rutina.mesociclo.semanas.map((s) => s.semana)
    numeros.forEach((n, i) => {
      if (n !== i + 1) {
        error(['mesociclo', 'semanas', i], 'Las semanas van en orden, desde la 1 y sin saltos')
      }
    })
    rutina.mesociclo.semanas.forEach((s, i) => {
      if (!s.descarga && !s.rir) error(['mesociclo', 'semanas', i, 'rir'], 'Falta el RIR')
    })
  })

export type Rutina = z.infer<typeof RutinaSchema>
export type Ejercicio = Rutina['ejercicios'][number]
export type Plan = Rutina['planes'][number]
export type Dia = Plan['dias'][number]
export type Slot = Dia['slots'][number]
export type Semana = Rutina['mesociclo']['semanas'][number]
