import { configurarEjercicio, elegirEjercicio, saltearEjercicio } from '../../datos/acciones'
import type { Serie, Sesion } from '../../datos/db'
import type { Unidad } from '../../dominio/series'
import { firma, vezAnterior } from '../../dominio/vezAnterior'
import type { Dia } from '../../rutina/schema'
import { boton } from '../../ui/botones'
import { fechaCorta, formatoNumero, resumenSeries } from '../../ui/formato'
import { Hoja } from '../../ui/Hoja'
import type { SlotEnSesion } from '../sesion/modelo'

const PASOS: Record<Unidad, number[]> = {
  kg: [0.5, 1, 1.25, 2, 2.5, 5, 10],
  lb: [1, 2.5, 5, 10, 15, 20],
  ladrillos: [1],
}
const NOMBRE_UNIDAD: Record<Unidad, string> = { kg: 'kg', lb: 'lb', ladrillos: 'Ladrillos' }

export function HojaOpciones({
  abierta,
  onCerrar,
  sesionId,
  actual,
  onCambiarEjercicio,
  onSalteado,
}: {
  abierta: boolean
  onCerrar: () => void
  sesionId: string
  actual: SlotEnSesion
  onCambiarEjercicio: () => void
  onSalteado: () => void
}) {
  const { ejercicio } = actual
  const pasoInicial = (u: Unidad) =>
    u === 'kg' ? (ejercicio.incremento ?? 2.5) : u === 'lb' ? 5 : 1

  return (
    <Hoja
      abierta={abierta}
      onCerrar={onCerrar}
      titulo={ejercicio.nombre}
      descripcion="Opciones de este ejercicio"
    >
      {ejercicio.carga !== 'sin-carga' && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold text-foot text-ink-2">
            Unidad de esta máquina
          </legend>
          <div className="flex rounded-[10px] bg-fill p-0.5">
            {(['kg', 'lb', 'ladrillos'] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={actual.unidad === u}
                onClick={() => void configurarEjercicio(ejercicio.id, u, pasoInicial(u))}
                className={`h-8 flex-1 rounded-lg font-semibold text-sub ${actual.unidad === u ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`}
              >
                {NOMBRE_UNIDAD[u]}
              </button>
            ))}
          </div>
          <p className="text-foot text-ink-3">
            Cada serie guarda su unidad: lo que anotaste antes no cambia. Los ladrillos se comparan
            solo con ladrillos y no suman al volumen en kg.
          </p>
        </fieldset>
      )}

      <div className="overflow-hidden rounded-2xl bg-surface-2">
        {ejercicio.carga !== 'sin-carga' && (
          <label className="relative flex min-h-[52px] items-center gap-3 border-fill border-b px-4">
            <span className="flex-1">Paso de carga</span>
            <span className="text-ink-3">
              {formatoNumero(actual.paso)}{' '}
              {actual.unidad === 'ladrillos' ? 'ladrillo' : actual.unidad}
            </span>
            <select
              className="absolute inset-0 cursor-pointer opacity-0"
              value={actual.paso}
              onChange={(e) =>
                void configurarEjercicio(ejercicio.id, actual.unidad, Number(e.target.value))
              }
            >
              {PASOS[actual.unidad].map((p) => (
                <option key={p} value={p}>
                  {formatoNumero(p)} {actual.unidad}
                </option>
              ))}
            </select>
          </label>
        )}
        {actual.opciones.length > 1 && (
          <button
            type="button"
            onClick={onCambiarEjercicio}
            className="flex min-h-[52px] w-full items-center gap-3 border-fill border-b px-4 text-left"
          >
            <span className="flex-1">Cambiar ejercicio</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            void saltearEjercicio(sesionId, actual.slot.id)
            onCerrar()
            onSalteado()
          }}
          className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left"
        >
          <span className="flex-1">Saltear este ejercicio hoy</span>
        </button>
      </div>
    </Hoja>
  )
}

export function HojaAlternativas({
  abierta,
  onCerrar,
  sesion,
  sesiones,
  historial,
  actual,
  dia,
}: {
  abierta: boolean
  onCerrar: () => void
  sesion: Sesion
  sesiones: Sesion[]
  historial: Serie[]
  actual: SlotEnSesion
  dia: Dia
}) {
  return (
    <Hoja
      abierta={abierta}
      onCerrar={onCerrar}
      titulo="Cambiar ejercicio"
      descripcion="¿Está ocupada? Elegí una alternativa permitida para este lugar de la rutina."
    >
      <div className="flex flex-col gap-2.5">
        {actual.opciones.map((op) => {
          const elegido = op.id === actual.ejercicio.id
          const { principal } = vezAnterior(sesiones, historial, {
            ejercicioId: op.id,
            dia: dia.clave,
            firma: firma(dia.clave, op.id, actual.slot),
            sesionActual: sesion.id,
          })
          return (
            <button
              key={op.id}
              type="button"
              aria-pressed={elegido}
              onClick={() => {
                void elegirEjercicio(sesion.id, actual.slot.id, op.id)
                onCerrar()
              }}
              className={`flex w-full items-center gap-3 rounded-[18px] p-3.5 text-left ${
                elegido
                  ? 'bg-accent-soft shadow-[inset_0_0_0_2px_var(--color-accent)]'
                  : 'shadow-[inset_0_0_0_1.5px_var(--color-line)]'
              }`}
            >
              <span
                className={`size-6 shrink-0 rounded-full ${elegido ? 'border-[7px] border-accent bg-white' : 'shadow-[inset_0_0_0_2px_var(--color-line-strong)]'}`}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold text-body">{op.nombre}</span>
                {op.detalle && <span className="text-foot text-ink-2">{op.detalle}</span>}
                <span className={`text-foot ${elegido ? 'text-accent-ink' : 'text-ink-3'}`}>
                  {principal
                    ? `Acá la última vez: ${fechaCorta(principal.sesion.fecha)} · ${resumenSeries(principal.series.filter((s, _i, t) => s.lado === (t[0]?.lado ?? null)))}`
                    : 'Todavía no lo hiciste acá'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="rounded-[14px] bg-surface-2 px-3 py-2.5 text-ink-2 text-sub">
        Cada ejercicio se compara con su propia última vez. Las series que ya hiciste quedan
        anotadas con el ejercicio con que las hiciste.
      </p>
      <button type="button" className={boton.neutro} onClick={onCerrar}>
        Volver
      </button>
    </Hoja>
  )
}
