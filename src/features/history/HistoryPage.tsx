import { EmptyState, Page } from '../../ui/Page'

export function HistoryPage() {
  return (
    <Page title="Historial">
      <EmptyState
        title="Todavía no hay sesiones"
        message="Cuando termines tu primera sesión, aparece acá."
      />
    </Page>
  )
}
