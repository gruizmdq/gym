import { EstadoVacio, Pagina } from '../../ui/Pagina'

export function HistorialPage() {
  return (
    <Pagina titulo="Historial">
      <EstadoVacio
        titulo="Todavía no hay sesiones"
        mensaje="Cuando termines tu primera sesión, aparece acá."
      />
    </Pagina>
  )
}
