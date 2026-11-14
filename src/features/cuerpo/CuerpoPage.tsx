import { EstadoVacio, Pagina } from '../../ui/Pagina'

export function CuerpoPage() {
  return (
    <Pagina titulo="Cuerpo">
      <EstadoVacio
        titulo="Todavía no hay mediciones"
        mensaje="Acá vas a registrar tu peso diario, la cintura y las circunferencias."
      />
    </Pagina>
  )
}
