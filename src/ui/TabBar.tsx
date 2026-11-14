import type { ComponentType, SVGProps } from 'react'
import { NavLink } from 'react-router'
import { IconoAjustes, IconoCuerpo, IconoHistorial, IconoHoy } from './iconos'

const secciones: { to: string; label: string; Icono: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { to: '/', label: 'Hoy', Icono: IconoHoy },
  { to: '/historial', label: 'Historial', Icono: IconoHistorial },
  { to: '/cuerpo', label: 'Cuerpo', Icono: IconoCuerpo },
  { to: '/ajustes', label: 'Ajustes', Icono: IconoAjustes },
]

export function TabBar() {
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-4 bottom-[max(12px,calc(env(safe-area-inset-bottom)-10px))] z-30 grid h-16 grid-cols-4 rounded-full bg-surface/85 p-1 shadow-float backdrop-blur-xl backdrop-saturate-150"
    >
      {secciones.map(({ to, label, Icono }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 rounded-full font-semibold text-caption transition-colors ${
              isActive ? 'bg-accent-soft text-accent' : 'text-ink-3'
            }`
          }
        >
          <Icono />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
