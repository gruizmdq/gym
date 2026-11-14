// Fechas de calendario local (Argentina) como 'AAAA-MM-DD'. Las cuentas se hacen en UTC
// para que ningún cambio de horario corra un día.
export type FechaISO = string

const DIA_MS = 86_400_000

export function fechaISO(d: Date): FechaISO {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function aUTC(f: FechaISO): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f)
  if (!m) throw new Error(`Fecha inválida: ${f}`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function diasEntre(desde: FechaISO, hasta: FechaISO): number {
  return Math.round((aUTC(hasta) - aUTC(desde)) / DIA_MS)
}

export function sumarDias(f: FechaISO, dias: number): FechaISO {
  return new Date(aUTC(f) + dias * DIA_MS).toISOString().slice(0, 10)
}
