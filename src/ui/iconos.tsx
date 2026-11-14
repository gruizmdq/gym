import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement>

function Icono({ children, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconoHoy(props: Props) {
  return (
    <Icono {...props}>
      <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
    </Icono>
  )
}

export function IconoHistorial(props: Props) {
  return (
    <Icono {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </Icono>
  )
}

export function IconoCuerpo(props: Props) {
  return (
    <Icono {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M8 10a5.5 5.5 0 0 1 8 0" />
      <path d="m12 11 1.6-2.2" />
    </Icono>
  )
}

export function IconoAjustes(props: Props) {
  return (
    <Icono {...props}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </Icono>
  )
}
