import type { ComponentType, SVGProps } from 'react'
import { NavLink } from 'react-router'
import { BodyIcon, HistoryIcon, SettingsIcon, TodayIcon } from './icons'

const sections: { to: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { to: '/', label: 'Hoy', Icon: TodayIcon },
  { to: '/history', label: 'Historial', Icon: HistoryIcon },
  { to: '/body', label: 'Cuerpo', Icon: BodyIcon },
  { to: '/settings', label: 'Ajustes', Icon: SettingsIcon },
]

export function TabBar() {
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-4 bottom-[max(12px,calc(env(safe-area-inset-bottom)-10px))] z-30 grid h-16 grid-cols-4 rounded-full bg-surface/85 p-1 shadow-float backdrop-blur-xl backdrop-saturate-150"
    >
      {sections.map(({ to, label, Icon }) => (
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
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
