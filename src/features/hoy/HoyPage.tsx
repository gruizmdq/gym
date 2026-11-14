import { EstadoVacio, Pagina } from '../../ui/Pagina'

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function HoyPage() {
  return (
    <Pagina titulo="Hoy" antetitulo={formatoFecha.format(new Date()).replace(',', '')}>
      <EstadoVacio
        titulo="Todavía no hay rutina"
        mensaje="Cuando esté cargada, acá vas a ver la sesión que te toca."
      />
    </Pagina>
  )
}
