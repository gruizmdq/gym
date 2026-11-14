import { Pagina } from '../../ui/Pagina'

export function AjustesPage() {
  return (
    <Pagina titulo="Ajustes">
      <p className="px-4 text-foot text-ink-3">
        Gym · versión <span className="font-num">{__BUILD__}</span>
      </p>
    </Pagina>
  )
}
