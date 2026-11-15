import { useState } from 'react'
import { useNavigate } from 'react-router'
import { empezarSesion, saltearDia } from '../../datos/acciones'
import { useMesociclos, useSesiones } from '../../datos/consultas'
import { fechaISO } from '../../dominio/fechas'
import { rutina } from '../../rutina/rutina'
import { boton } from '../../ui/botones'
import { fechaLarga } from '../../ui/formato'
import { Hoja } from '../../ui/Hoja'
import { Pagina } from '../../ui/Pagina'
import { armarEntrenamiento } from '../entrenamiento/estado'
import { ListaEjercicios, TarjetaMesocicloNuevo, TarjetaSemana, TarjetaToca } from './tarjetas'

// La barra de acciones va encima de la tab bar flotante.
const sobreTabBar = 'bottom-[calc(max(12px,env(safe-area-inset-bottom)-10px)+76px)]'

export function HoyPage() {
  const navigate = useNavigate()
  const registros = useMesociclos()
  const sesiones = useSesiones()
  const [confirmarSalteo, setConfirmarSalteo] = useState(false)
  const hoy = fechaISO(new Date())

  const e = registros && sesiones ? armarEntrenamiento(rutina, registros, sesiones, hoy) : undefined

  if (e === undefined) {
    return (
      <Pagina titulo="Hoy" antetitulo={fechaLarga(hoy)}>
        <div aria-busy="true" className="flex flex-col gap-3.5">
          <div className="h-56 animate-pulse rounded-card bg-fill" />
          <div className="h-36 animate-pulse rounded-card bg-fill" />
          <span className="sr-only">Cargando…</span>
        </div>
      </Pagina>
    )
  }

  if (e === null) {
    return (
      <Pagina titulo="Hoy" antetitulo={fechaLarga(hoy)}>
        <p className="rounded-card bg-surface p-4 text-ink-2 text-sub">
          No hay ningún mesociclo configurado. Elegí cuándo arranca en Ajustes.
        </p>
      </Pagina>
    )
  }

  const empezar = async () => {
    if (!e.continuar) await empezarSesion(e.plan.id, e.dia.clave)
    navigate('/sesion')
  }

  const saltear = async () => {
    await saltearDia(e.plan.id, e.dia.clave)
    setConfirmarSalteo(false)
  }

  return (
    <>
      <Pagina titulo="Hoy" antetitulo={fechaLarga(hoy)}>
        {e.puedeCambiarPlan && !e.continuar && (!e.meso.arrancado || e.meso.semana === 1) && (
          <TarjetaMesocicloNuevo e={e} />
        )}
        <TarjetaToca e={e} />
        <TarjetaSemana e={e} />
        <ListaEjercicios e={e} />
        <div className="h-36" aria-hidden="true" />
      </Pagina>

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(max(12px,env(safe-area-inset-bottom)-10px)+76px+150px)] bg-linear-to-b from-transparent to-bg to-35%"
        aria-hidden="true"
      />
      <div className={`fixed inset-x-4 z-20 flex flex-col gap-1 ${sobreTabBar}`}>
        <button type="button" className={boton.primario} onClick={() => void empezar()}>
          {e.continuar ? 'Continuar' : 'Empezar'} {e.dia.nombre}
        </button>
        {e.dia.salteable && !e.continuar && (
          <button type="button" className={boton.fantasma} onClick={() => setConfirmarSalteo(true)}>
            Saltear {e.dia.nombre}
          </button>
        )}
      </div>

      <Hoja
        abierta={confirmarSalteo}
        onCerrar={() => setConfirmarSalteo(false)}
        titulo={`¿Saltear el ${e.dia.nombre}?`}
        descripcion={`La rotación sigue con ${e.siguiente.nombre}. No cambia nada más.`}
      >
        <div className="flex flex-col gap-2">
          <button type="button" className={boton.primario} onClick={() => void saltear()}>
            Saltear {e.dia.nombre}
          </button>
          <button type="button" className={boton.neutro} onClick={() => setConfirmarSalteo(false)}>
            Volver
          </button>
        </div>
      </Hoja>
    </>
  )
}
