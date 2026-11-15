import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import {
  agregarSerie,
  completarFila,
  type DondeAnotar,
  guardarFila,
  sumarDescanso,
  terminarDescanso,
} from '../../datos/acciones'
import {
  useAjustesEjercicio,
  useSeriesDeEjercicios,
  useSeriesDeSesion,
  useSesiones,
} from '../../datos/consultas'
import { armarFilas, completaLaSerie, type Fila, filaActual } from '../../dominio/series'
import { tecnicaDeFirma, vezAnterior } from '../../dominio/vezAnterior'
import { rutina } from '../../rutina/rutina'
import { boton } from '../../ui/botones'
import { useAlturaTeclado } from '../../ui/dispositivo'
import { cronometro, fechaCorta, formatoNumero, rango, resumenSeries } from '../../ui/formato'
import { Stepper } from '../../ui/Stepper'
import { useAhora } from '../../ui/useAhora'
import { diaDeSesion, type SlotEnSesion, siguienteSlot, slotsDeSesion } from '../sesion/modelo'
import { HojaAlternativas, HojaOpciones } from './HojasEjercicio'

const LADO = { izquierda: 'Izquierda', derecha: 'Derecha' } as const
const LADO_CORTO = { izquierda: 'IZQ', derecha: 'DER' } as const
const TECNICA = {
  RP: 'al fallo, 15–20 s y 2 mini-series',
  DS: 'al fallo, bajá 25 % y seguí hasta casi el fallo',
  PE: 'después de las reps completas, 4–6 medias reps en la parte estirada',
} as const

const clave = (f: { indice: number; lado: string | null }) => `${f.indice}:${f.lado ?? '-'}`

function Icono({ d, size = 24 }: { d: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}
const CHECK = 'M20 6 9 17l-5-5'

function etiquetaUnidad(s: SlotEnSesion): string {
  if (s.unidad === 'ladrillos') return 'ladrillos'
  return s.ejercicio.carga === 'por-mancuerna' ? `${s.unidad} c/u` : s.unidad
}

export function EjercicioPage() {
  const { slotId } = useParams()
  const navigate = useNavigate()
  const sesiones = useSesiones()
  const sesion = sesiones?.find((s) => s.estado === 'en-curso')
  const seriesSesion = useSeriesDeSesion(sesion?.id)
  const ajustes = useAjustesEjercicio()
  const slots =
    sesion && seriesSesion && ajustes
      ? slotsDeSesion(rutina, sesion, seriesSesion, ajustes)
      : undefined
  const actual = slots?.find((s) => s.slot.id === slotId)
  const historial = useSeriesDeEjercicios(actual?.opciones.map((o) => o.id) ?? [])
  const ahora = useAhora(250)
  const teclado = useAlturaTeclado()
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<Fila | null>(null)
  const [ajustando, setAjustando] = useState(false)
  const [hoja, setHoja] = useState<'opciones' | 'alternativas' | null>(null)

  if (!sesiones) return <div aria-busy="true" className="min-h-dvh bg-bg" />
  if (!sesion) return <Navigate to="/" replace />
  if (!slots || !historial) return <div aria-busy="true" className="min-h-dvh bg-bg" />
  if (!actual) return <Navigate to="/sesion" replace />

  const dia = diaDeSesion(rutina, sesion)
  const ref = vezAnterior(sesiones, historial, {
    ejercicioId: actual.ejercicio.id,
    dia: dia.clave,
    firma: actual.firma,
    sesionActual: sesion.id,
  })
  const filas = armarFilas(
    {
      series: actual.series,
      repsMin: actual.reps.min,
      unilateral: actual.ejercicio.unilateral,
      ...(actual.slot.ladoPrimero ? { ladoPrimero: actual.slot.ladoPrimero } : {}),
      unidad: actual.unidad,
      paso: actual.paso,
    },
    ref.principal?.series ?? null,
    actual.guardadas,
  )
  const pendiente = filaActual(filas)
  const elegida = (seleccion ? filas.find((f) => clave(f) === seleccion) : null) ?? pendiente
  // La serie del panel se edita en local y se guarda en segundo plano: varios toques seguidos
  // en + no se pisan esperando a que vuelva la base.
  const enPanel = borrador && elegida && clave(borrador) === clave(elegida) ? borrador : elegida
  const anteriorDe = (f: Fila) =>
    ref.principal?.series.find((s) => s.indice === f.indice && s.lado === f.lado) ??
    ref.principal?.series.filter((s) => s.lado === f.lado).at(-1)

  const d: DondeAnotar = {
    sesionId: sesion.id,
    slotId: actual.slot.id,
    ejercicioId: actual.ejercicio.id,
    firma: actual.firma,
  }
  const siguiente = siguienteSlot(slots, actual.slot.id)
  const descanso = sesion.descanso ?? null
  const descansando = descanso !== null && ahora < descanso.terminaEn
  const pasado = descanso !== null && !descansando ? ahora - descanso.terminaEn : null
  const modo = descansando && !seleccion && !ajustando ? 'descanso' : elegida ? 'serie' : 'completo'
  const posicion = dia.slots.findIndex((s) => s.id === actual.slot.id) + 1

  const completar = async (fila: Fila) => {
    if (fila.hecha) {
      await guardarFila(d, fila)
    } else {
      const despues = filas.map((f) => (clave(f) === clave(fila) ? { ...f, hecha: true } : f))
      const cierra = completaLaSerie(despues, fila.indice)
      await completarFila(d, fila, cierra ? actual.slot.descanso : null)
    }
    setSeleccion(null)
    setBorrador(null)
    setAjustando(false)
  }

  const tocarCheck = (fila: Fila) => {
    if (fila.hecha) void guardarFila(d, { ...fila, hecha: false })
    else void completar(fila)
  }

  return (
    <div className="flex min-h-dvh flex-col gap-2.5 px-4 pt-[env(safe-area-inset-top)]">
      <nav className="-mx-2.5 flex h-11 items-center justify-between">
        <Link
          to="/sesion"
          className="flex h-11 items-center gap-0.5 pr-2.5 pl-1 text-accent text-body"
        >
          <Icono d="m15 18-6-6 6-6" />
          {dia.nombre}
        </Link>
        <span className="font-num font-semibold text-ink-2 text-sub">
          {posicion} de {dia.slots.length}
        </span>
        <div className="flex">
          {actual.opciones.length > 1 && (
            <button
              type="button"
              onClick={() => setHoja('alternativas')}
              aria-label="Cambiar ejercicio"
              className="flex size-11 items-center justify-center rounded-full text-accent"
            >
              <Icono d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setHoja('opciones')}
            aria-label="Opciones del ejercicio"
            className="flex size-11 items-center justify-center rounded-full text-accent"
          >
            <Icono d="M5 12h.01M12 12h.01M19 12h.01" />
          </button>
        </div>
      </nav>

      <header className="flex flex-col gap-0.5">
        <h1 className="font-bold text-title tracking-[-.015em]">{actual.ejercicio.nombre}</h1>
        {actual.ejercicio.detalle && (
          <p className="text-ink-2 text-sub">{actual.ejercicio.detalle}</p>
        )}
      </header>

      <Prescripcion actual={actual} semanaDescarga={!!sesion.descarga} />
      <VezAnterior referencias={ref} />

      <section className="rounded-card bg-surface px-1.5 pt-0.5 pb-1.5" aria-label="Series">
        <div
          className="grid h-[30px] grid-cols-[minmax(0,1fr)_36px_44px] items-center pl-1.5"
          aria-hidden="true"
        >
          <div
            className={`grid items-center gap-x-1 ${actual.lados[0] ? 'grid-cols-[62px_minmax(0,1fr)_62px_50px]' : 'grid-cols-[34px_minmax(0,1fr)_62px_50px]'}`}
          >
            <span className="font-semibold text-[12px] text-ink-3">Serie</span>
            <span className="font-semibold text-[12px] text-ink-3">Anterior</span>
            <span className="text-center font-semibold text-[12px] text-ink-3">
              {actual.unidad === 'ladrillos' ? 'Lad.' : actual.unidad === 'lb' ? 'Lb' : 'Kg'}
            </span>
            <span className="text-center font-semibold text-[12px] text-ink-3">Reps</span>
          </div>
          <span className="text-center font-semibold text-[12px] text-ink-3">Cad.</span>
          <span />
        </div>
        {filas.map((f) => {
          const actualFila = modo === 'serie' && elegida && clave(elegida) === clave(f)
          const ant = anteriorDe(f)
          const esUltima = f.indice === actual.series
          return (
            <div
              key={clave(f)}
              className={`grid h-[52px] grid-cols-[minmax(0,1fr)_36px_44px] items-center rounded-[14px] pl-1.5 ${
                actualFila ? 'bg-accent-soft shadow-[inset_0_0_0_2px_var(--color-accent)]' : ''
              } ${f.lado && f.lado !== actual.lados[0] ? '' : f.indice > 1 && actual.lados[0] ? 'mt-1' : ''}`}
            >
              <button
                type="button"
                onClick={() => setSeleccion(clave(f))}
                aria-label={`Editar serie ${f.indice}${f.lado ? `, ${LADO[f.lado].toLowerCase()}` : ''}`}
                className={`grid h-[52px] items-center gap-x-1 text-left ${f.lado ? 'grid-cols-[62px_minmax(0,1fr)_62px_50px]' : 'grid-cols-[34px_minmax(0,1fr)_62px_50px]'}`}
              >
                <span className="inline-flex items-center gap-1">
                  <span
                    className={`inline-flex size-7 items-center justify-center rounded-full font-bold font-num text-[14px] ${actualFila ? 'bg-accent text-white' : f.hecha ? 'bg-ink text-white' : 'bg-fill text-ink-2'}`}
                  >
                    {f.indice}
                  </span>
                  {f.lado && (
                    <span
                      className={`font-bold text-[11px] ${actualFila ? 'text-accent-ink' : 'text-ink-3'}`}
                    >
                      {LADO_CORTO[f.lado]}
                    </span>
                  )}
                  {!f.lado && esUltima && actual.tecnica?.aplica && (
                    <span className="text-tech">
                      <Icono
                        size={14}
                        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"
                      />
                    </span>
                  )}
                </span>
                <span className="truncate font-num text-ink-3 text-sub">
                  {ant
                    ? `${ant.peso === null ? '' : `${formatoNumero(ant.peso)} × `}${ant.reps}${ant.repsTecnica ? ` +${ant.repsTecnica}` : ''}`
                    : '—'}
                </span>
                <span
                  className={`text-center font-bold font-num text-[20px] ${f.hecha || actualFila ? 'text-ink' : 'text-ink-3/60'}`}
                >
                  {f.peso === null ? '—' : formatoNumero(f.peso)}
                </span>
                <span
                  className={`text-center font-bold font-num text-[20px] ${f.hecha || actualFila ? 'text-ink' : 'text-ink-3/60'}`}
                >
                  {f.reps}
                  {f.hecha && f.tecnicaHecha && f.repsTecnica ? (
                    <sup className="ml-px font-bold text-[11px] text-tech">+{f.repsTecnica}</sup>
                  ) : null}
                </span>
              </button>
              <span
                className="flex justify-center"
                role="img"
                aria-label={
                  f.hecha
                    ? f.cadenciaOk
                      ? 'Cadencia respetada'
                      : 'Cadencia no respetada'
                    : 'Cadencia sin marcar'
                }
              >
                <span
                  className={`inline-flex size-[22px] items-center justify-center rounded-[7px] ${!f.hecha ? 'shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] text-transparent' : f.cadenciaOk ? 'bg-accent-soft text-accent-ink' : 'bg-warn-soft text-warn'}`}
                >
                  <Icono size={14} d={f.hecha && !f.cadenciaOk ? 'M6 12h12' : CHECK} />
                </span>
              </span>
              <button
                type="button"
                onClick={() => tocarCheck(f)}
                aria-label={`${f.hecha ? 'Desmarcar' : 'Completar'} serie ${f.indice}${f.lado ? `, ${LADO[f.lado].toLowerCase()}` : ''}`}
                className="flex size-11 items-center justify-center"
                disabled={!f.hecha && f.peso === null && actual.ejercicio.carga !== 'sin-carga'}
              >
                <span
                  className={`inline-flex size-[30px] items-center justify-center rounded-full ${f.hecha ? 'bg-accent text-white' : 'text-transparent shadow-[inset_0_0_0_2px_var(--color-line-strong)]'}`}
                >
                  <Icono size={18} d={CHECK} />
                </span>
              </button>
            </div>
          )
        })}
      </section>

      <div className="h-[340px] shrink-0" aria-hidden="true" />

      <section
        aria-label="Serie actual"
        className="fixed inset-x-0 z-20 flex flex-col gap-3 rounded-t-[26px] bg-surface px-4 pt-3.5 shadow-panel"
        style={{
          bottom: teclado,
          paddingBottom: teclado ? 12 : 'calc(env(safe-area-inset-bottom) + 12px)',
        }}
      >
        {modo === 'descanso' && descanso && (
          <PanelDescanso
            restante={descanso.terminaEn - ahora}
            total={descanso.total}
            sigue={
              pendiente
                ? `Sigue: serie ${pendiente.indice}${pendiente.lado ? ` · ${LADO[pendiente.lado].toLowerCase()}` : ''}${pendiente.peso !== null ? ` · ${formatoNumero(pendiente.peso)} × ${pendiente.reps}` : ''}`
                : siguiente
                  ? `Sigue: ${siguiente.ejercicio.nombre}`
                  : 'Terminaste todos los ejercicios'
            }
            onAjustar={pendiente ? () => setAjustando(true) : null}
            onSumar={(ms) => void sumarDescanso(sesion.id, ms)}
            onSaltar={() => void terminarDescanso(sesion.id)}
          />
        )}

        {modo === 'serie' && enPanel && (
          <PanelSerie
            fila={enPanel}
            actual={actual}
            anterior={anteriorDe(enPanel)}
            igualar={igualarA(filas, enPanel, actual)}
            pasado={pasado}
            onCambio={(f) => {
              setBorrador(f)
              void guardarFila(d, f)
            }}
            onCompletar={(f) => void completar(f)}
          />
        )}

        {modo === 'completo' && (
          <>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-ink text-white">
                <Icono d={CHECK} />
              </span>
              <div className="flex flex-col">
                <span className="font-semibold text-body">{actual.ejercicio.nombre}</span>
                <span className="text-foot text-ink-3">
                  Hiciste {actual.seriesHechas} series · cadencia ok en{' '}
                  {filas.filter((f) => f.hecha && f.cadenciaOk).length} de{' '}
                  {filas.filter((f) => f.hecha).length}
                </span>
              </div>
            </div>
            <button
              type="button"
              className={boton.fantasma}
              onClick={() => void agregarSerie(sesion.id, actual.slot.id)}
            >
              <Icono size={18} d="M5 12h14M12 5v14" />
              Agregar serie
            </button>
            {siguiente ? (
              <Link to={`/sesion/ejercicio/${siguiente.slot.id}`} className={boton.primario}>
                Siguiente: {siguiente.ejercicio.nombre}
              </Link>
            ) : (
              <Link to="/sesion" className={boton.primario}>
                Volver a la sesión
              </Link>
            )}
          </>
        )}
      </section>

      <HojaOpciones
        abierta={hoja === 'opciones'}
        onCerrar={() => setHoja(null)}
        sesionId={sesion.id}
        actual={actual}
        onCambiarEjercicio={() => setHoja('alternativas')}
        onSalteado={() =>
          navigate(siguiente ? `/sesion/ejercicio/${siguiente.slot.id}` : '/sesion')
        }
      />
      <HojaAlternativas
        abierta={hoja === 'alternativas'}
        onCerrar={() => setHoja(null)}
        sesion={sesion}
        sesiones={sesiones}
        historial={historial}
        actual={actual}
        dia={dia}
      />
    </div>
  )
}

// Segundo lado de una unilateral: iguala las reps que ya hizo el primero en esa serie.
function igualarA(filas: Fila[], fila: Fila, actual: SlotEnSesion): number | null {
  const primerLado = actual.lados[0]
  if (!fila.lado || fila.lado === primerLado || fila.hecha) return null
  const primera = filas.find((f) => f.indice === fila.indice && f.lado === primerLado && f.hecha)
  return primera ? primera.reps : null
}

function Prescripcion({
  actual,
  semanaDescarga,
}: {
  actual: SlotEnSesion
  semanaDescarga: boolean
}) {
  const { slot, tecnica } = actual
  const pausa = Number(slot.cadencia.split('-')[1] ?? 0)
  return (
    <section className="overflow-hidden rounded-card bg-surface" aria-label="Prescripción">
      <dl className="grid grid-cols-4 py-3">
        {[
          ['Series', `${actual.series} × ${rango(actual.reps)}`],
          ['Descanso', cronometro(slot.descanso * 1000)],
          ['Cadencia', slot.cadencia],
          ['RIR', actual.rir ? (actual.rir.max === 0 ? 'Fallo' : rango(actual.rir)) : '—'],
        ].map(([k, v]) => (
          <div
            key={k}
            className="flex flex-col items-center gap-0.5 border-line border-r last:border-r-0"
          >
            <dt className="font-semibold text-[12px] text-ink-3 leading-4">{k}</dt>
            <dd className="font-bold font-num text-[18px] leading-[22px]">{v}</dd>
          </div>
        ))}
      </dl>
      {tecnica && (
        <p
          className={`flex items-center gap-2 border-line border-t px-3.5 py-2.5 text-[14px] leading-[19px] ${tecnica.aplica ? 'bg-tech-soft text-tech' : 'bg-surface-2 text-ink-2'}`}
        >
          {tecnica.aplica ? (
            <span>
              <b className="font-semibold">{tecnica.tipo} en la última serie:</b>{' '}
              {TECNICA[tecnica.tipo]}
            </span>
          ) : semanaDescarga ? (
            <span>Descarga: sin {tecnica.tipo} esta semana.</span>
          ) : (
            <span>
              {tecnica.tipo} en la última serie
              {tecnica.desdeSemana ? ` desde la semana ${tecnica.desdeSemana}` : ''}.
            </span>
          )}
        </p>
      )}
      {slot.pausa && (
        <p className="flex items-center gap-2 border-line border-t bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink-2 leading-[19px]">
          <Icono size={18} d="M12 5v14M18 13l-6 6-6-6" />
          <span>
            <b className="font-semibold text-ink">Pausa de {pausa || 1} s estirado:</b> {slot.pausa}
          </span>
        </p>
      )}
      {slot.nota && (
        <p className="border-line border-t px-3.5 py-2.5 text-[14px] text-ink-2 leading-[19px]">
          {slot.nota}
        </p>
      )}
    </section>
  )
}

function VezAnterior({ referencias }: { referencias: ReturnType<typeof vezAnterior> }) {
  const { principal, secundaria } = referencias
  return (
    <section
      className="flex flex-col gap-2 rounded-card bg-surface px-3.5 py-2.5"
      aria-label="La vez anterior"
    >
      {principal ? (
        <div className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-foot text-ink-2">
            <b className="font-semibold text-ink">{fechaCorta(principal.sesion.fecha)}</b>
            {principal.equivalente ? ' · misma prescripción' : ' · prescripción distinta'}
          </span>
          {principal.equivalente ? (
            <span className="flex h-[22px] items-center rounded-full bg-accent-soft px-2 font-semibold text-[12px] text-accent-ink">
              Prellenado
            </span>
          ) : (
            <span className="flex h-[22px] items-center rounded-full bg-warn-soft px-2 font-semibold text-[12px] text-warn">
              No equivalente
            </span>
          )}
        </div>
      ) : (
        <p className="text-foot text-ink-3">
          Primera vez con este ejercicio acá: anotá el peso con el que arranques.
        </p>
      )}
      {secundaria && (
        <div className="flex items-start gap-2">
          <span
            className="mt-[5px] size-2 shrink-0 rounded-full bg-line-strong"
            aria-hidden="true"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-foot text-ink-2">
              <b className="font-semibold text-ink">{fechaCorta(secundaria.sesion.fecha)}</b> ·{' '}
              {nombreDia(secundaria.sesion.dia)}
              {etiquetaTecnica(secundaria)}
            </span>
            <span className="font-num font-semibold text-sub">
              {resumenSeries(
                secundaria.series.filter((s, _i, todas) => s.lado === (todas[0]?.lado ?? null)),
                secundaria.series[0] ? tecnicaDeFirma(secundaria.series[0].firma) : null,
              )}
            </span>
          </span>
        </div>
      )}
    </section>
  )
}

function nombreDia(clave: string): string {
  for (const plan of rutina.planes) {
    const dia = plan.dias.find((d) => d.clave === clave)
    if (dia) return dia.nombre
  }
  return clave
}

function etiquetaTecnica(r: { series: { firma: string; tecnicaHecha: boolean }[] }): string {
  const tecnica = r.series[0] ? tecnicaDeFirma(r.series[0].firma) : null
  if (!tecnica) return ' · sin técnica'
  return r.series.some((s) => s.tecnicaHecha) ? ` · ${tecnica}` : ' · sin técnica'
}

function PanelSerie({
  fila,
  actual,
  anterior,
  igualar,
  pasado,
  onCambio,
  onCompletar,
}: {
  fila: Fila
  actual: SlotEnSesion
  anterior: { peso: number | null; reps: number; repsTecnica: number | null } | undefined
  igualar: number | null
  pasado: number | null
  onCambio: (f: Fila) => void
  onCompletar: (f: Fila) => void
}) {
  const sinCarga = actual.ejercicio.carga === 'sin-carga'
  const esUltima = fila.indice === actual.series
  const conTecnica = esUltima && actual.tecnica?.aplica
  const faltaPeso = !sinCarga && fila.peso === null
  const titulo = `Serie ${fila.indice} ${fila.lado ? `· ${LADO[fila.lado]}` : `de ${actual.series}`}`
  const textoBoton = faltaPeso
    ? 'Escribí el peso'
    : fila.hecha
      ? 'Guardar cambios'
      : fila.lado
        ? `Completar ${LADO[fila.lado].toLowerCase()}`
        : `Completar serie ${fila.indice}`

  const toggleCadencia = (
    <button
      type="button"
      aria-pressed={fila.cadenciaOk}
      onClick={() => onCambio({ ...fila, cadenciaOk: !fila.cadenciaOk })}
      className={`flex items-center justify-center gap-2 rounded-xl font-semibold text-sub ${
        fila.cadenciaOk
          ? 'bg-accent-soft text-accent-ink shadow-[inset_0_0_0_1.5px_var(--color-accent)]'
          : 'text-ink-2 shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]'
      } ${conTecnica ? 'h-11 flex-1' : 'h-14 w-[146px] shrink-0 rounded-2xl'}`}
    >
      <span
        className={`inline-flex size-5 items-center justify-center rounded-md ${fila.cadenciaOk ? 'bg-accent text-white' : 'text-transparent shadow-[inset_0_0_0_2px_currentColor]'}`}
      >
        <Icono size={14} d={CHECK} />
      </span>
      Cadencia ok
    </button>
  )

  const completar = (
    <button
      type="button"
      disabled={faltaPeso}
      onClick={() => onCompletar(fila)}
      className={conTecnica ? boton.primario : `${boton.primario} w-auto flex-1`}
    >
      {!faltaPeso && <Icono size={18} d={CHECK} />}
      {textoBoton}
    </button>
  )

  return (
    <>
      {pasado !== null && (
        <div
          role="status"
          className="-mx-4 -mt-3.5 flex items-center justify-between rounded-t-[26px] bg-accent px-4 py-3 font-semibold text-sub text-white"
        >
          <span>Terminó el descanso</span>
          <span className="font-num">hace {cronometro(pasado)}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-body">{titulo}</span>
        {igualar !== null ? (
          <span className="flex h-[26px] items-center rounded-full bg-accent-soft px-2.5 font-semibold text-accent-ink text-foot">
            Igualá {igualar} reps
          </span>
        ) : anterior ? (
          <span className="font-num text-foot text-ink-3">
            Anterior {anterior.peso === null ? '' : `${formatoNumero(anterior.peso)} × `}
            {anterior.reps}
            {anterior.repsTecnica ? ` + ${anterior.repsTecnica}` : ''}
          </span>
        ) : null}
      </div>
      <div className="flex gap-2.5">
        {!sinCarga && (
          <Stepper
            valor={fila.peso}
            onCambio={(peso) => onCambio({ ...fila, peso })}
            paso={actual.paso}
            unidad={`${etiquetaUnidad(actual)} · ±${formatoNumero(actual.paso)}`}
            etiqueta="Peso"
          />
        )}
        <Stepper
          valor={fila.reps}
          onCambio={(reps) => onCambio({ ...fila, reps: reps ?? fila.reps })}
          paso={1}
          unidad="reps"
          etiqueta="Repeticiones"
          decimales={false}
        />
      </div>
      {conTecnica ? (
        <>
          <div className="flex gap-2.5">
            {toggleCadencia}
            <button
              type="button"
              aria-pressed={fila.tecnicaHecha}
              onClick={() =>
                onCambio({
                  ...fila,
                  tecnicaHecha: !fila.tecnicaHecha,
                  repsTecnica: !fila.tecnicaHecha ? (fila.repsTecnica ?? 4) : fila.repsTecnica,
                })
              }
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl font-semibold text-sub ${
                fila.tecnicaHecha
                  ? 'bg-tech-soft text-tech shadow-[inset_0_0_0_1.5px_var(--color-tech)]'
                  : 'text-ink-2 shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]'
              }`}
            >
              <span
                className={`inline-flex size-5 items-center justify-center rounded-md ${fila.tecnicaHecha ? 'bg-tech text-white' : 'text-transparent shadow-[inset_0_0_0_2px_currentColor]'}`}
              >
                <Icono size={14} d={CHECK} />
              </span>
              {actual.tecnica?.tipo} hecho
            </button>
          </div>
          {fila.tecnicaHecha && (
            <div className="flex items-center justify-between gap-2.5 px-0.5">
              <span className="text-ink-2 text-sub">Reps de la técnica</span>
              <div className="flex items-center rounded-xl bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-line)]">
                <button
                  type="button"
                  aria-label="Restar una rep de la técnica"
                  className="flex size-11 items-center justify-center"
                  onClick={() =>
                    onCambio({ ...fila, repsTecnica: Math.max(0, (fila.repsTecnica ?? 0) - 1) })
                  }
                >
                  <Icono size={18} d="M5 12h14" />
                </button>
                <span className="min-w-6 text-center font-bold font-num text-[20px]">
                  {fila.repsTecnica ?? 0}
                </span>
                <button
                  type="button"
                  aria-label="Sumar una rep de la técnica"
                  className="flex size-11 items-center justify-center"
                  onClick={() => onCambio({ ...fila, repsTecnica: (fila.repsTecnica ?? 0) + 1 })}
                >
                  <Icono size={18} d="M5 12h14M12 5v14" />
                </button>
              </div>
            </div>
          )}
          {completar}
        </>
      ) : (
        <div className="flex gap-2.5">
          {toggleCadencia}
          {completar}
        </div>
      )}
    </>
  )
}

function PanelDescanso({
  restante,
  total,
  sigue,
  onAjustar,
  onSumar,
  onSaltar,
}: {
  restante: number
  total: number
  sigue: string
  onAjustar: (() => void) | null
  onSumar: (ms: number) => void
  onSaltar: () => void
}) {
  // Se redondea para arriba: el timer no muestra 0:00 mientras falta casi un segundo.
  const segundos = Math.ceil(restante / 1000)
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-body">Descanso</span>
        <span className="font-num text-foot text-ink-3">de {cronometro(total)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span
          role="timer"
          className="font-bold font-num text-[64px] text-accent leading-[68px] tracking-[-.02em]"
        >
          {cronometro(segundos * 1000)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="h-11 rounded-[14px] bg-fill px-4 font-semibold text-body"
            onClick={() => onSumar(-15_000)}
          >
            −15 s
          </button>
          <button
            type="button"
            className="h-11 rounded-[14px] bg-fill px-4 font-semibold text-body"
            onClick={() => onSumar(15_000)}
          >
            +15 s
          </button>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-fill" aria-hidden="true">
        <i
          className="block h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, (100 * restante) / total)}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-num text-ink-2 text-sub">{sigue}</span>
        {onAjustar && (
          <button
            type="button"
            className="h-9 shrink-0 px-1 font-semibold text-accent text-sub"
            onClick={onAjustar}
          >
            Ajustar
          </button>
        )}
      </div>
      <button type="button" className={boton.secundario} onClick={onSaltar}>
        <Icono size={18} d="m6 4 10 8-10 8ZM19 5v14" />
        Saltar descanso
      </button>
    </>
  )
}
