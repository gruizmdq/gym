import { EmptyState, Page } from '../../ui/Page'

export function BodyPage() {
  return (
    <Page title="Cuerpo">
      <EmptyState
        title="Todavía no hay mediciones"
        message="Acá vas a registrar tu peso diario, la cintura y las circunferencias."
      />
    </Page>
  )
}
