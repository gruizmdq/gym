import type {
  AjusteEjercicio,
  Mesociclo,
  Serie,
  Sesion,
  Sincronizable,
  VersionRutina,
} from '../datos/db'

// Cómo se ve cada tabla del teléfono en Postgres. Las columnas usan los mismos nombres que la
// app, en snake_case, para que se puedan consultar con SQL sin traducir.

export type FilaRemota = Record<string, unknown>

export interface DefinicionTabla<L extends Sincronizable> {
  local: 'rutinas' | 'mesociclos' | 'sesiones' | 'series' | 'ajustesEjercicio'
  remota: string
  // Columnas del upsert (clave primaria en Postgres).
  conflicto: string
  claveLocal: (fila: L) => string | number
  claveRemota: (fila: FilaRemota) => string | number
  aRemota: (fila: L, userId: string) => FilaRemota
  aLocal: (fila: FilaRemota) => L
}

const iso = (ms: number) => new Date(ms).toISOString()
const ms = (valor: unknown) => Date.parse(String(valor))
const texto = (valor: unknown) => String(valor)
const numero = (valor: unknown) => Number(valor)
const numeroONulo = (valor: unknown) =>
  valor === null || valor === undefined ? null : Number(valor)

function sync(fila: Sincronizable, userId: string): FilaRemota {
  return { user_id: userId, actualizado_en: iso(fila.actualizadoEn) }
}

function deRemota(fila: FilaRemota): Sincronizable {
  return { actualizadoEn: ms(fila.actualizado_en), pendiente: 0 }
}

const rutinas: DefinicionTabla<VersionRutina> = {
  local: 'rutinas',
  remota: 'rutinas',
  conflicto: 'user_id,version',
  claveLocal: (f) => f.version,
  claveRemota: (f) => texto(f.version),
  aRemota: (f, u) => ({
    ...sync(f, u),
    version: f.version,
    contenido: f.contenido,
    vista_en: iso(f.vistaEn),
  }),
  aLocal: (f) => ({
    ...deRemota(f),
    version: texto(f.version),
    contenido: f.contenido,
    vistaEn: ms(f.vista_en),
  }),
}

const mesociclos: DefinicionTabla<Mesociclo> = {
  local: 'mesociclos',
  remota: 'mesociclos',
  conflicto: 'user_id,numero',
  claveLocal: (f) => f.numero,
  claveRemota: (f) => numero(f.numero),
  aRemota: (f, u) => ({ ...sync(f, u), numero: f.numero, plan: f.plan, inicio: f.inicio }),
  aLocal: (f) => ({
    ...deRemota(f),
    numero: numero(f.numero),
    plan: texto(f.plan),
    inicio: texto(f.inicio),
  }),
}

const sesiones: DefinicionTabla<Sesion> = {
  local: 'sesiones',
  remota: 'sesiones',
  conflicto: 'user_id,id',
  claveLocal: (f) => f.id,
  claveRemota: (f) => texto(f.id),
  aRemota: (f, u) => ({
    ...sync(f, u),
    id: f.id,
    plan: f.plan,
    dia: f.dia,
    fecha: f.fecha,
    estado: f.estado,
    mesociclo: f.mesociclo,
    semana: f.semana,
    descarga: f.descarga ?? false,
    version_rutina: f.versionRutina,
    iniciada_en: iso(f.iniciadaEn),
    finalizada_en: f.finalizadaEn === undefined ? null : iso(f.finalizadaEn),
    orden: f.orden,
    elegidos: f.elegidos ?? {},
    extras: f.extras ?? {},
    salteados: f.salteados ?? [],
    descanso: f.descanso ?? null,
    notas: f.notas ?? null,
  }),
  aLocal: (f) => ({
    ...deRemota(f),
    id: texto(f.id),
    plan: texto(f.plan),
    dia: texto(f.dia),
    fecha: texto(f.fecha),
    estado: texto(f.estado) as Sesion['estado'],
    mesociclo: numero(f.mesociclo),
    semana: numero(f.semana),
    descarga: Boolean(f.descarga),
    versionRutina: texto(f.version_rutina),
    iniciadaEn: ms(f.iniciada_en),
    ...(f.finalizada_en ? { finalizadaEn: ms(f.finalizada_en) } : {}),
    orden: numero(f.orden),
    elegidos: (f.elegidos ?? {}) as Record<string, string>,
    extras: (f.extras ?? {}) as Record<string, number>,
    salteados: (f.salteados ?? []) as string[],
    descanso: (f.descanso ?? null) as Sesion['descanso'],
    ...(typeof f.notas === 'string' ? { notas: f.notas } : {}),
  }),
}

const series: DefinicionTabla<Serie> = {
  local: 'series',
  remota: 'series',
  conflicto: 'user_id,id',
  claveLocal: (f) => f.id,
  claveRemota: (f) => texto(f.id),
  aRemota: (f, u) => ({
    ...sync(f, u),
    id: f.id,
    sesion_id: f.sesionId,
    slot_id: f.slotId,
    ejercicio_id: f.ejercicioId,
    firma: f.firma,
    indice: f.indice,
    lado: f.lado,
    peso: f.peso,
    unidad: f.unidad,
    reps: f.reps,
    cadencia_ok: f.cadenciaOk,
    tecnica_hecha: f.tecnicaHecha,
    reps_tecnica: f.repsTecnica,
    hecha: f.hecha,
  }),
  aLocal: (f) => ({
    ...deRemota(f),
    id: texto(f.id),
    sesionId: texto(f.sesion_id),
    slotId: texto(f.slot_id),
    ejercicioId: texto(f.ejercicio_id),
    firma: texto(f.firma),
    indice: numero(f.indice),
    lado: (f.lado ?? null) as Serie['lado'],
    peso: numeroONulo(f.peso),
    unidad: texto(f.unidad) as Serie['unidad'],
    reps: numero(f.reps),
    cadenciaOk: Boolean(f.cadencia_ok),
    tecnicaHecha: Boolean(f.tecnica_hecha),
    repsTecnica: numeroONulo(f.reps_tecnica),
    hecha: Boolean(f.hecha),
  }),
}

const ajustesEjercicio: DefinicionTabla<AjusteEjercicio> = {
  local: 'ajustesEjercicio',
  remota: 'ajustes_ejercicio',
  conflicto: 'user_id,ejercicio_id',
  claveLocal: (f) => f.ejercicioId,
  claveRemota: (f) => texto(f.ejercicio_id),
  aRemota: (f, u) => ({
    ...sync(f, u),
    ejercicio_id: f.ejercicioId,
    unidad: f.unidad,
    paso: f.paso,
  }),
  aLocal: (f) => ({
    ...deRemota(f),
    ejercicioId: texto(f.ejercicio_id),
    unidad: texto(f.unidad) as AjusteEjercicio['unidad'],
    paso: numero(f.paso),
  }),
}

// En este orden: las series referencian a su sesión, que tiene que subir antes.
export const TABLAS = [rutinas, mesociclos, sesiones, series, ajustesEjercicio] as const
