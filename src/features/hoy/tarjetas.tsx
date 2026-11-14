import { cambiarPlanActual } from '../../datos/acciones'
import { rutina } from '../../rutina/rutina'
import { duracion, fechaLarga, rango, rir } from '../../ui/formato'
import { abreviatura, type Entrenamiento } from '../entrenamiento/estado'

const tick = (
  <svg
    viewBox="0 0 24 24"
    width={14}
    height={14}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export function TarjetaMesocicloNuevo({ e }: { e: Entrenamiento }) {
  const { meso, semana } = e
  const titulo = meso.arrancado
    ? `Empieza el mesociclo ${meso.numero}`
    : `El mesociclo ${meso.numero} arranca el ${fechaLarga(meso.inicio)}`

  return (
    <section className="flex flex-col gap-3.5 rounded-card bg-ink p-4 text-white">
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-accent-mid text-foot uppercase tracking-[.03em]">
          Mesociclo nuevo
        </p>
        <h2 className="font-bold text-title-2">{titulo}</h2>
        {semana.semana === 1 && semana.rir && (
          <p className="text-line-strong text-sub">
            Semana 1{semana.nombre ? `: ${semana.nombre.toLowerCase()}` : ''}.{' '}
            {rir(semana.rir.compuesto)} en todo{semana.tecnicas ? '' : ', sin técnicas'}.
          </p>
        )}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold text-foot text-line-strong">
          Plan de este mesociclo
        </legend>
        <div className="flex rounded-[10px] bg-ink-2/40 p-0.5">
          {rutina.planes.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === meso.plan}
              onClick={() => void cambiarPlanActual(p.id)}
              className={`h-8 flex-1 rounded-lg font-semibold text-sub ${
                p.id === meso.plan ? 'bg-surface text-ink shadow-sm' : 'text-line-strong'
              }`}
            >
              {p.nombre}
            </button>
          ))}
        </div>
        <p className="text-foot text-line-strong">
          Podés cambiarlo hasta tu primera sesión. Después queda fijo para que las cargas se puedan
          comparar.
        </p>
      </fieldset>
      {e.principal && (
        <p className="rounded-xl bg-ink-2/30 p-3 text-line text-sub">
          Principal de {e.principal.dia.nombre} en este mesociclo:{' '}
          <b className="font-semibold text-white">{e.principal.ejercicio.nombre}</b>.
        </p>
      )}
    </section>
  )
}

export function TarjetaToca({ e }: { e: Entrenamiento }) {
  const { dia, meso } = e
  return (
    <section className="flex flex-col gap-3.5 rounded-card bg-surface px-4 pt-[18px] pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="font-semibold text-accent-ink text-foot uppercase tracking-[.03em]">
            {e.continuar ? 'Seguís con' : 'Te toca'}
          </p>
          <h2 className="font-bold text-[36px] leading-[41px] tracking-[-.02em]">{dia.nombre}</h2>
          <p className="text-ink-2 text-sub">
            {dia.foco} · {e.ejercicios.length} ejercicios · {e.seriesTotales} series
          </p>
        </div>
        {meso.arrancado && (
          <span className="flex h-[26px] shrink-0 items-center rounded-full bg-accent-soft px-2.5 font-semibold text-accent-ink text-foot">
            Meso {meso.numero} · Sem {meso.semana}
          </span>
        )}
      </div>

      <ol
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${e.rotacion.length}, minmax(0, 1fr))` }}
        aria-label="Rotación del plan"
      >
        {e.rotacion.map(({ dia: d, estado }) => (
          <li
            key={d.clave}
            className={`flex flex-col items-center gap-1.5 rounded-[14px] pt-2 pb-1.5 font-semibold text-caption ${
              estado === 'toca' ? 'bg-accent-soft text-accent-ink' : 'text-ink-3'
            }`}
          >
            <span
              className={`flex size-[30px] items-center justify-center rounded-full font-bold text-[12px] ${
                estado === 'toca'
                  ? 'bg-accent text-white'
                  : estado === 'hecho'
                    ? 'bg-ink text-white'
                    : estado === 'salteado'
                      ? 'border-[1.5px] border-line-strong border-dashed text-ink-3'
                      : 'bg-fill text-ink-2'
              }`}
            >
              {estado === 'hecho' ? tick : abreviatura(d)}
            </span>
            {d.nombre}
            <span className="sr-only">
              {estado === 'hecho'
                ? ', hecho'
                : estado === 'salteado'
                  ? ', salteado'
                  : estado === 'toca'
                    ? ', toca hoy'
                    : ''}
            </span>
          </li>
        ))}
      </ol>

      {e.avisos.map((aviso) => (
        <p
          key={aviso}
          className="rounded-[14px] bg-warn-soft px-3 py-2.5 font-semibold text-sub text-warn"
        >
          {aviso}
        </p>
      ))}

      {dia.salteable && !e.continuar && (
        <p className="rounded-[14px] bg-surface-2 px-3 py-2.5 text-ink-2 text-sub">
          ¿Esta semana entrenás 4 días? Salteá el {dia.nombre}: la rotación sigue con{' '}
          {e.siguiente.nombre} y no cambia nada más.
        </p>
      )}

      {e.ultimaDuracion !== null && (
        <p className="text-foot text-ink-3">
          La última {dia.nombre} te llevó {duracion(e.ultimaDuracion)}.
        </p>
      )}
    </section>
  )
}

export function TarjetaSemana({ e }: { e: Entrenamiento }) {
  const { semana, meso, plan } = e
  const total = rutina.mesociclo.semanas.length
  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-4">
      <div className="flex flex-col">
        <h2 className="font-semibold text-body">
          Semana {semana.semana} de {total}
          {semana.nombre ? ` · ${semana.nombre}` : ''}
        </h2>
        <span className="text-foot text-ink-3">
          Mesociclo {meso.numero} · Plan {plan.nombre}
        </span>
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {rutina.mesociclo.semanas.map((s) => (
          <i
            key={s.semana}
            className={`h-1.5 rounded-full ${
              s.semana < semana.semana
                ? 'bg-accent-mid'
                : s.semana === semana.semana
                  ? 'bg-accent'
                  : 'bg-fill'
            }`}
          />
        ))}
      </div>

      {semana.rir ? (
        <dl className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 p-2.5">
            <dt className="text-foot text-ink-3">Compuestos</dt>
            <dd className="font-num font-semibold text-body">{rir(semana.rir.compuesto)}</dd>
          </div>
          <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 p-2.5">
            <dt className="text-foot text-ink-3">Aislamientos</dt>
            <dd className="font-num font-semibold text-body">{rir(semana.rir.aislamiento)}</dd>
          </div>
          <div
            className={`flex flex-col gap-0.5 rounded-xl p-2.5 ${semana.tecnicas ? 'bg-tech-soft text-tech' : 'bg-surface-2'}`}
          >
            <dt className={`text-foot ${semana.tecnicas ? '' : 'text-ink-3'}`}>Técnicas</dt>
            <dd className="font-semibold text-body">{semana.tecnicas ? 'Sí' : 'No'}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-ink-2 text-sub">
          Descarga: mismas cargas, mitad de las series y sin técnicas.
        </p>
      )}

      {semana.nota && (
        <p className="rounded-[14px] bg-surface-2 px-3 py-2.5 text-ink-2 text-sub">{semana.nota}</p>
      )}
    </section>
  )
}

export function ListaEjercicios({ e }: { e: Entrenamiento }) {
  return (
    <section
      className="overflow-hidden rounded-2xl bg-surface"
      aria-label={`Ejercicios de ${e.dia.nombre}`}
    >
      <ul>
        {e.ejercicios.map((x) => (
          <li
            key={x.slot.id}
            className="flex min-h-[52px] items-center gap-3 border-line border-b px-4 py-2.5 last:border-b-0"
          >
            <span className="min-w-0 flex-1">{x.ejercicio.nombre}</span>
            <span className="font-num text-ink-3 text-sub">
              {x.series} × {rango(x.reps)}
            </span>
            {x.tecnica?.aplica && (
              <span className="flex h-[26px] items-center rounded-full bg-tech-soft px-2.5 font-semibold text-foot text-tech">
                {x.tecnica.tipo}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
