import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { guardarNotas } from '../../datos/acciones'
import { useAjustesEjercicio, useSeriesDeSesion, useSesiones } from '../../datos/consultas'
import type { Serie } from '../../datos/db'
import { volumen } from '../../dominio/series'
import { rutina } from '../../rutina/rutina'
import { boton } from '../../ui/botones'
import { duracion, fechaLarga } from '../../ui/formato'
import { diaDeSesion, ejercicioPorId, slotsDeSesion } from '../sesion/modelo'

const entero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

function volumenTotal(series: Serie[]): number {
  return series.reduce((t, s) => t + volumen(s, ejercicioPorId(rutina, s.ejercicioId).carga), 0)
}

function Dato({
  titulo,
  valor,
  unidad,
  nota,
}: {
  titulo: string
  valor: string
  unidad?: string
  nota?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-card bg-surface p-3.5">
      <dt className="text-foot text-ink-3">{titulo}</dt>
      <dd className="font-bold font-num text-[26px] leading-8">
        {valor} {unidad && <span className="font-normal text-ink-3 text-sub">{unidad}</span>}
      </dd>
      {nota && <dd className="font-semibold text-foot text-ink-3">{nota}</dd>}
    </div>
  )
}

export function ResumenPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const sesiones = useSesiones()
  const sesion = sesiones?.find((s) => s.id === id)
  const series = useSeriesDeSesion(id)
  const ajustes = useAjustesEjercicio()
  // La última vez que se hizo este mismo día, para comparar el volumen.
  const anterior = sesiones
    ?.filter(
      (s) => sesion && s.dia === sesion.dia && s.estado === 'terminada' && s.orden < sesion.orden,
    )
    .sort((a, b) => b.orden - a.orden)[0]
  const seriesAnterior = useSeriesDeSesion(anterior?.id)
  const [notas, setNotas] = useState<string | null>(null)

  if (!sesiones || !series || !ajustes) return <div aria-busy="true" className="min-h-dvh bg-bg" />
  if (!sesion) return <Navigate to="/" replace />

  const dia = diaDeSesion(rutina, sesion)
  const slots = slotsDeSesion(rutina, sesion, series, ajustes)
  const hechas = series.filter((s) => s.hecha)
  const total = slots.reduce((t, s) => t + (s.salteado ? 0 : s.series), 0)
  const seriesHechas = slots.reduce((t, s) => t + s.seriesHechas, 0)
  const conTecnica = slots.filter((s) => s.tecnica?.aplica)
  const tecnicas = conTecnica.filter((s) =>
    s.guardadas.some((g) => g.hecha && g.tecnicaHecha),
  ).length
  const volumenHoy = volumenTotal(series)
  const volumenAntes = seriesAnterior?.length ? volumenTotal(seriesAnterior) : null
  const diferencia = volumenAntes
    ? Math.round((100 * (volumenHoy - volumenAntes)) / volumenAntes)
    : null
  const sinHacer = slots.filter((s) => s.seriesHechas === 0)

  return (
    <div className="flex min-h-dvh flex-col gap-3.5 px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <header className="flex flex-col">
        <p className="font-semibold text-foot text-ink-3 uppercase tracking-[.03em]">
          {fechaLarga(sesion.fecha)} · Sem {sesion.semana}
        </p>
        <h1 className="font-bold text-[32px] leading-[39px] tracking-[-.02em]">
          Terminaste {dia.nombre}
        </h1>
      </header>

      <dl className="grid grid-cols-2 gap-2.5" aria-label="Números de la sesión">
        <Dato
          titulo="Duración"
          valor={sesion.finalizadaEn ? duracion(sesion.finalizadaEn - sesion.iniciadaEn) : '—'}
        />
        <Dato
          titulo="Volumen"
          valor={entero.format(volumenHoy)}
          unidad="kg"
          {...(diferencia !== null && anterior
            ? { nota: `${diferencia >= 0 ? '+' : ''}${diferencia} % vs la anterior` }
            : {})}
        />
        <Dato titulo="Series" valor={String(seriesHechas)} unidad={`de ${total}`} />
        <Dato
          titulo="Cadencia ok"
          valor={String(hechas.filter((s) => s.cadenciaOk).length)}
          unidad={`de ${hechas.length}`}
          {...(conTecnica.length ? { nota: `Técnicas ${tecnicas} de ${conTecnica.length}` } : {})}
        />
      </dl>

      {sinHacer.length > 0 && (
        <p className="rounded-[14px] bg-surface px-3 py-2.5 text-ink-2 text-sub">
          Quedaron sin hacer: {sinHacer.map((s) => s.ejercicio.nombre).join(', ')}.
        </p>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="font-semibold text-foot text-ink-3">Notas de la sesión</span>
        <textarea
          value={notas ?? sesion.notas ?? ''}
          onChange={(e) => {
            setNotas(e.target.value)
            void guardarNotas(sesion.id, e.target.value)
          }}
          placeholder="Molestias, máquina distinta, cómo dormiste…"
          rows={4}
          className="resize-none rounded-[14px] bg-surface px-3.5 py-3 text-body shadow-[inset_0_0_0_1px_var(--color-line)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-accent)]"
        />
      </label>

      <div className="flex-1" />
      <button
        type="button"
        className={boton.primario}
        onClick={() => navigate('/', { replace: true })}
      >
        Cerrar
      </button>
    </div>
  )
}
