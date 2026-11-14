import { diasEntre, type FechaISO, sumarDias } from './fechas'

// Solo se guardan los mesociclos que alguien tocó (el primero, un cambio de plan o de semana).
// Los demás se derivan: al terminar uno, el siguiente arranca solo con el mismo plan.
export interface RegistroMesociclo {
  numero: number
  plan: string
  inicio: FechaISO
}

export interface MesocicloVigente extends RegistroMesociclo {
  semana: number
  // false: todavía no llegó la fecha de inicio (Hoy muestra cuándo arranca).
  arrancado: boolean
}

function compararInicio(a: RegistroMesociclo, b: RegistroMesociclo): number {
  if (a.inicio !== b.inicio) return a.inicio < b.inicio ? -1 : 1
  return a.numero - b.numero
}

export function mesocicloEn(
  registros: RegistroMesociclo[],
  fecha: FechaISO,
  semanasPorMesociclo: number,
): MesocicloVigente | null {
  const base = registros
    .filter((r) => r.inicio <= fecha)
    .sort(compararInicio)
    .at(-1)
  if (!base) return null

  const duracion = semanasPorMesociclo * 7
  const dias = diasEntre(base.inicio, fecha)
  const saltos = Math.floor(dias / duracion)
  return {
    numero: base.numero + saltos,
    plan: base.plan,
    inicio: sumarDias(base.inicio, saltos * duracion),
    semana: Math.floor((dias - saltos * duracion) / 7) + 1,
    arrancado: true,
  }
}

// El mesociclo en curso o, si todavía no arrancó ninguno, el próximo (en su semana 1).
export function mesocicloVigente(
  registros: RegistroMesociclo[],
  fecha: FechaISO,
  semanasPorMesociclo: number,
): MesocicloVigente | null {
  const enCurso = mesocicloEn(registros, fecha, semanasPorMesociclo)
  if (enCurso) return enCurso
  const proximo = [...registros].sort(compararInicio)[0]
  return proximo ? { ...proximo, semana: 1, arrancado: false } : null
}

function guardar(registros: RegistroMesociclo[], nuevo: RegistroMesociclo): RegistroMesociclo[] {
  return [...registros.filter((r) => r.numero !== nuevo.numero), nuevo].sort(compararInicio)
}

// El cambio manual de semana corre la fecha de inicio del mesociclo vigente.
export function cambiarSemana(
  registros: RegistroMesociclo[],
  fecha: FechaISO,
  semana: number,
  semanasPorMesociclo: number,
): RegistroMesociclo[] {
  const actual = mesocicloVigente(registros, fecha, semanasPorMesociclo)
  if (!actual?.arrancado) return registros
  const destino = Math.min(Math.max(semana, 1), semanasPorMesociclo)
  const inicio = sumarDias(actual.inicio, (actual.semana - destino) * 7)
  return guardar(registros, { numero: actual.numero, plan: actual.plan, inicio })
}

export function cambiarPlan(
  registros: RegistroMesociclo[],
  fecha: FechaISO,
  plan: string,
  semanasPorMesociclo: number,
): RegistroMesociclo[] {
  const actual = mesocicloVigente(registros, fecha, semanasPorMesociclo)
  if (!actual) return registros
  return guardar(registros, { numero: actual.numero, plan, inicio: actual.inicio })
}

export function cambiarInicio(
  registros: RegistroMesociclo[],
  fecha: FechaISO,
  inicio: FechaISO,
  semanasPorMesociclo: number,
): RegistroMesociclo[] {
  const actual = mesocicloVigente(registros, fecha, semanasPorMesociclo)
  if (!actual) return registros
  return guardar(registros, { numero: actual.numero, plan: actual.plan, inicio })
}

// Si se termina una sesión antes de que arranque el primer mesociclo, el inicio se corre a
// ese día: la sesión ya es la semana 1.
export function arrancarAntes(
  registros: RegistroMesociclo[],
  fecha: FechaISO,
  semanasPorMesociclo: number,
): RegistroMesociclo[] {
  const vigente = mesocicloVigente(registros, fecha, semanasPorMesociclo)
  if (!vigente || vigente.arrancado) return registros
  return guardar(registros, { numero: vigente.numero, plan: vigente.plan, inicio: fecha })
}
