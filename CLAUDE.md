# Gym — PWA personal de entrenamiento

App web para registrar entrenamientos de gimnasio. Un solo usuario (Gonza), instalada
como PWA en un iPhone 17 ("Agregar a inicio"). Reemplaza a Hevy. Offline first.
Interfaz en español rioplatense, unidades en kg. **El código va en inglés** (ver Idioma).

La rutina vigente está en `Rutina_bulk_Gonza_v2.pdf` (versión 14/11/2026). El porqué de
cada decisión está en `docs/decisiones.md`: este archivo dice **qué** se hace.

## Supuestos
Si hay varias interpretaciones, presentalas; no elijas en silencio. Si algo no está
claro (una regla de la rutina, un caso de borde del dominio, una decisión de producto),
pará y preguntá.

## Estado
- **Fase 0, lienzos:** [Gym · Lienzos](https://claude.ai/artifact/JjepiWviYnpoD3prTXjbmP).
  Aprobados por Gonza el 14/11/2026. Después se agregaron la unidad por ejercicio,
  terminar con pendientes y la carga tardía.
- **Fase 1:** mergeada y desplegada en Cloudflare. Falta probarla en el iPhone.
- **Fase 2 (rama `fase-2`, PR pendiente):** rutina como dato, dominio (mesociclo, rotación,
  prescripción semanal) con tests, Dexie, Hoy, Ajustes (plan, inicio y semana).
- **Fase 3 (rama `fase-3`, sale de `fase-2`):** sesión activa. Ejercicio con panel inferior,
  prellenado desde la vez anterior, referencia secundaria, descanso por timestamps, Wake Lock,
  teclado con `visualViewport`, unidad y paso por ejercicio, alternativas, saltear,
  terminar con pendientes y resumen.
- **Fase 4 (rama `fase-4`, sale de `fase-3`):** Supabase (migración con RLS, cursor por
  secuencia y última escritura gana), Dexie v3 con marca de pendiente, motor de sync, login
  persistente, estado en Hoy y Ajustes, latido semanal. Probado contra Supabase local.
- **Código en inglés (rama `english-codebase`):** identificadores, archivos, ids, tablas de
  Dexie y de Supabase. La migración `20261114230000_english_names.sql` reemplaza las tablas
  vacías de la primera; ya está aplicada en el proyecto real (14/11/2026).
- **Fase 5 (rama `fase-5`):** progresión doble (aviso con "Subir" en el ejercicio y "Para la
  próxima" en el resumen) y alerta de retroceso en el resumen. La referencia secundaria y el
  aviso de no equivalente ya estaban desde la fase 3.
- **Fase 6 (rama `fase-6`, sale de `fase-5`):** Cuerpo (peso, cintura, circunferencias),
  historial de sesiones y de ejercicio con gráficos, y carga tardía. Dexie v6 y la migración
  `20261115000000_body_and_backfill.sql`, ya aplicada en el proyecto real (15/11/2026).
- **Fase 7 (rama `fase-7`):** export en JSON y CSV desde Ajustes, y servidor MCP remoto en el
  mismo Worker (`/mcp`), con OAuth sobre el login de Supabase: lee todo y escribe peso,
  cintura, circunferencias y notas. Probado contra Supabase local con `wrangler dev`. **El
  import de Hevy está en pausa** hasta tener el `workouts.csv` real (decisiones ya tomadas en
  `decisiones.md`, Pendiente). Sin tablas nuevas.
- **Mac (rama `desktop-layout`, sale de `fase-7`):** en pantallas anchas la app es una columna
  de 402 px centrada, las hojas son modales y hay hover con mouse. En el iPhone no cambia nada.
- **Fase 8 (rama `fase-8`):** aviso de fin de descanso por push. La app le dice al Worker qué
  aviso tiene que tener cada dispositivo; un Durable Object por dispositivo lo programa con una
  alarma y manda el Web Push (cifrado y VAPID propios, con Web Crypto). Se activa en Ajustes.
  Sin tablas nuevas. Probado con tests, `curl` y `wrangler dev` contra Supabase local (la alarma
  llega a FCM). El secreto `VAPID_PRIVATE_KEY` ya está en Cloudflare (15/11/2026). **Falta
  probarlo en el iPhone** (el navegador integrado de la app de Claude no tiene service worker
  ni notificaciones).
- **Datos cargados por SQL:** 273 pesajes históricos (11/10/2025 al 15/11/2026), el 15/11/2026.
- **Rutina completa (rama `routine-view`):** `/routine/:day` muestra todos los días del plan, de
  a uno, con la ficha de prescripción de cada ejercicio. Se entra desde los días de la rotación
  en Hoy o desde "Ver la rutina completa". Arranca en el plan y la semana actuales; se puede ver
  el otro plan y cualquier semana del mesociclo (`?plan=4d&week=5`). Solo lee.
- **Peso con dos decimales (rama `body-weights`):** pesajes, promedios y cambio con hasta dos
  decimales, stepper de a 0,05, rango 5 sem / 3 meses / Todo en los dos gráficos y la lista de
  todos los pesajes (`/body/weights`). Sin tablas nuevas.

## Plan por fases
| Fase | Contenido | Lista cuando |
|---|---|---|
| 0 | Lienzos de todas las pantallas | Gonza los aprueba |
| 1 | Repo, tooling, CI, base de la PWA, deploy | Instalada en el iPhone, abre como app y anda en modo avión |
| 2 | Esquema Zod + rutina completa, dominio (mesociclo, rotación, prescripción semanal), Dexie, Hoy, Ajustes | Hoy muestra la sesión, la semana y el RIR correctos |
| 3 | Sesión activa sin conexión: series, panel inferior, unidad por ejercicio, unilaterales, alternativas, terminar con pendientes, Wake Lock, prellenado, descanso, resumen | Una sesión entera en modo avión, cerrando la app a la mitad, sin perder nada |
| 4 | Supabase: migraciones, RLS, login, sync, Supabase MCP de solo lectura | Datos en Supabase. Desde acá reemplaza a Hevy |
| 5 | Referencia secundaria, aviso de no equivalente, progresión, alerta de retroceso | — |
| 6 | Cuerpo (peso, cintura, circunferencias), historial, gráficos y carga tardía | — |
| 7 | Import de Hevy, export, servidor MCP remoto | — |
| 8 | Push al terminar el descanso (opcional) | — |

## Stack
Vite 8 + React 19 + TypeScript 7 (strict) + Tailwind v4 + React Router 8 · Dexie 4 con
`useLiveQuery` (sin store global) · vite-plugin-pwa 2 · Supabase (Postgres, Auth, RLS;
región São Paulo) · Cloudflare Workers con static assets en `*.workers.dev` · GitHub
Actions · Biome · Vitest + Playwright (WebKit).

## Comandos
- `npm run dev` (:5173) · `npm run preview` (:4173: sirve `dist/` con el service worker).
- `npm run verify`: lint (Biome) + tests (Vitest) + build (`tsc -b` + Vite) + bundle del
  Worker (`wrangler deploy --dry-run`). Es exactamente lo que corren CI y el deploy: si pasa
  local, pasa allá.
- `npx wrangler dev` (:8787): el Worker con el MCP remoto y el push, sirviendo `dist/` (hacé
  `npm run build` antes). `.dev.vars` (no se commitea) lo apunta al Supabase local y tiene un
  `VAPID_PRIVATE_KEY` propio de local, par del `VITE_VAPID_PUBLIC_KEY` de `.env.local`. Después
  de tocar `wrangler.jsonc`: `npx wrangler types worker/worker-configuration.d.ts` (y Biome
  sobre la salida: el archivo está fuera de `biome.json`).
- Par VAPID nuevo (para local o para cambiar el de producción); imprime la clave pública y el
  JWK privado:
  `node -e "crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign']).then(async k=>console.log(Buffer.from(await crypto.subtle.exportKey('raw',k.publicKey)).toString('base64url'),JSON.stringify(await crypto.subtle.exportKey('jwk',k.privateKey))))"`
- `npm run format`: Biome con `--write`. Biome no toca los `.md`.
- `npm run icons`: regenera íconos y splash desde `public/icon.svg`
  (`pwa-assets.config.ts`). El generador imprime links con `-light-` en el nombre, pero los
  archivos no lo tienen: en `index.html` van los nombres reales.
- Node 24 (`.node-version`). `.npmrc` guarda versiones exactas: las actualizaciones son
  explícitas.

## Deploy
- Cloudflare Workers con static assets (`wrangler.jsonc`), en `gym.<subdominio>.workers.dev`.
  Workers Builds está conectado al repo: cada push a `main` corre `npm run verify` y, si
  pasa, `npx wrangler deploy`. No hay tokens de Cloudflare en GitHub.
- GitHub Actions corre `npm run verify` en cada PR y en `main`.
- `public/_headers`: `/assets/*` inmutable; `sw.js` e `index.html` sin caché.
- **El Worker (`worker/`) solo atiende `/mcp`, `/authorize`, `/token`, `/register`,
  `/.well-known/*` y `/push/*`** (`run_worker_first`); el resto son los archivos de la app.
  OAuth guarda clientes y grants en el KV `OAUTH_KV`, que `wrangler deploy` crea solo la
  primera vez. Las alarmas del descanso viven en el Durable Object `RestAlarm` (SQLite,
  declarado en `exports`: no se vuelve a `migrations`).
- **Secreto del Worker `VAPID_PRIVATE_KEY`:** la clave privada del push (un JWK), par de
  `VITE_VAPID_PUBLIC_KEY` en `.env`. Se carga una vez, en el dashboard (Workers › gym ›
  Settings › Variables and Secrets) o con `npx wrangler secret put VAPID_PRIVATE_KEY`. Sin él,
  `/push/rest` responde 503 y el aviso no se puede activar. Cambiar el par obliga a cambiar los
  dos y a volver a activar el aviso en cada dispositivo.
- **Conectar Claude:** en los conectores de Claude (claude.ai o la app), agregar un conector
  personalizado con `https://gym.<subdominio>.workers.dev/mcp`. Pide el email y la contraseña
  de la app.
- **Las versiones nuevas nunca recargan solas:** el service worker nuevo espera y la app
  muestra "Hay una versión nueva" hasta que se toca Actualizar. Además se busca versión
  nueva cada vez que la app vuelve a primer plano.
- La versión que está corriendo (commit corto) se ve en Ajustes.

## Supabase
- `supabase/migrations/` es la verdad del esquema. Al proyecto real se aplica con
  `npx supabase db push --remote` (la CLI 3 apunta al stack local si falta `--remote`). Pide
  la contraseña de la base: la escribe Gonza en su terminal.
- **Local:** `npx supabase start` levanta todo en Docker (realtime, studio, storage y edge
  apagados en `supabase/config.toml`). `.env.local` (no se commitea) apunta ahí y tiene un
  usuario de prueba que solo existe en local. `npx supabase stop` lo apaga sin borrar datos.
- `.env` (commiteado) tiene la URL y la clave **publicable** del proyecto real: son públicas,
  igual van dentro de la app. La `secret`/`service_role` nunca entra al repo ni a la app.
- Columnas en snake_case con los mismos nombres que la app. Cada tabla: `user_id` con RLS,
  `updated_at` (hora del teléfono: gana la más nueva; el trigger ignora una más vieja),
  `deleted_at` (borrado lógico, sin `delete`) y `seq` (cursor del pull).
- **Para analizar y cargar datos:** el MCP `supabase` de `.mcp.json` (proyecto
  `wuampfwqeqbqbbxdqzzq`) deja consultar y escribir con SQL. Se autentica una vez con `/mcp`
  en Claude Code. **El esquema se cambia solo con migraciones, nunca con el MCP.**
  - Una escritura por SQL tiene que llegar al teléfono: `updated_at = now()` (el trigger le
    asigna `seq`) y `user_id` explícito (por SQL no hay `auth.uid()`).
  - Nada de `delete`: el pull no ve filas borradas. Se borra con `deleted_at = now()`.
  - Una carga no pisa lo que ya hay (`on conflict do nothing`), salvo que Gonza lo pida.
- **Desde la app de Claude:** el MCP remoto del Worker (`/mcp`) responde con el mismo dominio
  que la app (estado, rutina de la semana, sesiones, historial de un ejercicio, cuerpo).
- `public.heartbeat()` existe solo para el cron semanal (`.github/workflows/heartbeat.yml`)
  que evita la pausa del plan gratuito.

## Estructura
```
routine/routine.json la rutina (dato); la valida src/routine/schema.test.ts
src/domain/          reglas puras con tests: fechas, mesociclo, rotación, prescripción, series, vez anterior
src/data/            Dexie: db.ts (tablas), actions.ts (toda escritura), queries.ts (lecturas vivas)
src/features/<x>/    pantallas; training/state.ts junta dominio + datos para Hoy, sesión y Ajustes
src/ui/              piezas sin dominio: Page, Sheet (<dialog>), TabBar, format, buttons
src/pwa/             service worker (se registra desde main.tsx, fuera del router) y almacenamiento
src/push/            el aviso de fin de descanso: device.ts (permiso, suscripción, pedido al Worker),
                     start.ts (mira la sesión en Dexie y le dice al Worker qué aviso va)
public/push-sw.js    push y toque de la notificación; lo importa el service worker generado
src/sync/            el único que habla con Supabase: tables.ts (mapeo), engine.ts (subir, bajar,
                     resolver), start.ts (cuándo corre, login), status.ts (lo que ve la UI)
src/features/session/model.ts   cada slot de la sesión en curso: ejercicio elegido, unidad, firma, progreso
src/features/exercise/          la pantalla central: filas, panel inferior y hojas de opciones
worker/              el MCP remoto (Cloudflare Worker): index.ts (OAuth), authorize.ts (login),
                     mcp.ts (tools), report.ts y writes.ts (puros, con tests), supabase.ts y
                     data.ts (Supabase como Gonza). Reusa src/domain, la rutina y sync/tables.ts.
                     El push: push.ts (ruta), restAlarm.ts (Durable Object), rest.ts y
                     webpush.ts (puros, con tests: RFC 8291 y 8292)
```
- Para probar en el navegador sin ensuciar la rotación, descartá la sesión en vez de
  terminarla. Antes del 7/12, terminar una sesión corre el inicio del mesociclo 1 a ese
  día: se vuelve a poner en Ajustes.

## Arquitectura: reglas duras
- **La UI solo habla con Dexie. El único que habla con Supabase es el sync.** Nada de
  fetch a Supabase desde una pantalla. Fuera de la app, el MCP remoto habla con Supabase
  **como Gonza**: su sesión va cifrada en el grant de OAuth y aplica RLS. Nunca `service_role`.
  El push del descanso también mira Dexie: las pantallas solo escriben el descanso y
  `src/push/` le avisa al Worker (no a Supabase), con el token de la sesión del sync.
- **Cada toque se escribe en Dexie al instante.** iOS puede matar la app en cualquier
  momento; no hay estado importante que viva solo en memoria (tampoco el descanso: se
  guarda como timestamp de fin).
- **Dominio puro en `src/domain/`**: sin React, sin Dexie, sin fechas del sistema
  (el "ahora" entra por parámetro). Todo lo de abajo vive ahí y lleva tests.
- **Sync:** ids uuid generados en el cliente; cada fila sincronizable tiene
  `updated_at`, `deleted_at` (borrado lógico) y marca de pendiente. Push = upsert
  idempotente; pull = cambios desde un cursor que asigna el server (secuencia, no el
  reloj del teléfono). Gana la última escritura por fila.
- **La siembra del mesociclo 1 (base nueva) va con `updatedAt: 0`:** es la versión más vieja
  posible. En un teléfono reinstalado gana la del servidor; con el servidor vacío, sube.
- **Auth:** Supabase email + contraseña, `persistSession` y `autoRefreshToken`. Los
  signups quedan deshabilitados después de crear el usuario. RLS restringe cada tabla a
  `user_id = (select auth.uid())`. La app funciona sin sesión: la sesión solo la usa el
  sync.
- **Rutina:** `routine/routine.json`, con la forma de `src/routine/schema.ts` (Zod). El test
  `src/routine/schema.test.ts` la valida: si no valida, no hay deploy. Para editarla:
  cambiá el JSON y corré `npm run test`; el error dice qué día, slot y campo fallan.
  La versión es el hash del contenido. Al abrir, la app guarda la versión en
  `routines` (local y Supabase); cada sesión guarda con qué versión se hizo.
  Cada plan lista sus días completos, **sin herencia**. Los días tienen una clave
  compartida entre planes (`lower-a`). Los avisos por semana (test de banca) son datos
  del día, no código.

## Reglas de dominio
- **Rotación:** "hoy toca" es la sesión siguiente a la última completada (por fecha), en la secuencia
  del plan activo, sin importar el día de la semana. **Solo el Día 5 se puede saltear**
  (botón "Saltear Día 5"); los demás no.
- **Cambio de plan (5d ↔ 4d):** solo al empezar un mesociclo, hasta la primera sesión de
  ese mesociclo. La rotación sigue desde el último día hecho; si ese día no existe en el
  plan nuevo (Día 5 → 4d), arranca en Lower A.
- **Mesociclo:** 6 semanas contadas desde su fecha de inicio. El cambio manual de semana
  mueve esa fecha. Al terminar la semana 6, el siguiente arranca solo.
- **Semanas:**

  | Semana | RIR compuestos | RIR aislamientos | Técnicas |
  |---|---|---|---|
  | 1 | 2–3 | 2–3 (calibración) | No |
  | 2 | 1–2 | 0–1 | No en el mesociclo 1; sí desde el 2 |
  | 3 | 1–2 | 0–1 | Sí |
  | 4–5 | 1 | 0 (fallo real) | Sí. Se puede agregar 1 serie de laterales y 1 de dorsal |
  | 6 (descarga) | — | — | No. Mismas cargas, mitad de series **redondeando para arriba** |

- **Técnicas** (RP, DS, PE): solo en la última serie y solo donde el slot la indica.
- **Principal de Lower A:** alterna péndulo (mesociclos impares) y sentadilla de palanca
  (pares). La prensa queda fija.
- **Firma de prescripción** = clave de día + ejercicio realmente usado + rango de reps +
  cadencia + técnica del slot. Unilateral es parte del ejercicio: la extensión unilateral
  es otro ejercicio del catálogo, con su propio historial.
- **El historial sigue al ejercicio, nunca al lugar en la rutina.** Cambiar de rutina o
  reemplazar un ejercicio no pierde ni mezcla historial. Los ids del catálogo son estables:
  nunca se renombran ni se reutilizan para otro ejercicio. Usar una alternativa en la
  sesión anota las series a nombre de la alternativa.
- **La vez anterior:**
  - Principal: la última vez de este ejercicio con la misma firma. Se usa para prellenar.
  - Si no hay, la última vez de este ejercicio en el mismo día de rutina (otra prescripción
    o una rutina anterior), con aviso de "no equivalente".
  - Secundaria: el mismo ejercicio en otro día o en otra rutina, con etiqueta de contexto
    ("Jue · Lower B · sin técnica").
  - Las sesiones de descarga no son referencia principal ni cuentan para progresión.
- **Progresión (doble):** si en la referencia principal todas las series llegaron al techo
  del rango con `tempoOk`, se sugiere subir el incremento mínimo del ejercicio y volver al
  piso. En unilaterales, por lado. Las reps extra de la técnica no cuentan. **Es una
  sugerencia, nunca un cambio automático.**
  - Solo contra la referencia principal equivalente. Cuentan las series prescriptas; las
    agregadas a mano no.
  - No hay sugerencia en la semana 1 (calibración) ni en la descarga.
  - En el ejercicio se aplica con "Subir" (las pendientes de ese lado pasan al peso nuevo y
    al piso). En el resumen, "Para la próxima" muestra los que suben y los que quedaron a
    exactamente 1 rep; después de la semana 5 no muestra nada.
- **Alerta de retroceso:** si un compuesto retrocede dos sesiones seguidas, se avisa:
  "sacá las técnicas esta semana antes de tocar otra cosa".
  - Rendimiento de una sesión = peso tope; a igual peso, reps a ese peso (sin técnica, solo
    las series prescriptas). lb se compara en kg; ladrillos solo con ladrillos.
  - Últimas tres sesiones con la misma firma, sin descarga, de cualquier mesociclo. Una
    sesión con series de menos no entra en la cadena.
  - Se muestra en el resumen de la sesión que cierra la cadena. Unilaterales: alcanza con
    un lado.
- **Sesión:**
  - Orden libre: se puede empezar por cualquier ejercicio.
  - Solo series efectivas: las de aproximación no se anotan.
  - Terminar con ejercicios pendientes cuenta como hecha para la rotación; los que faltaron
    quedan como salteados. Una sesión recién empezada se puede descartar.
  - En la app, el fin del descanso es solo visual: el panel cambia de color y cuenta el
    tiempo de más. Además puede llegar un push (abajo).
- **Aviso de fin de descanso (push):**
  - Se activa y se apaga por dispositivo, solo en Ajustes › Entrenamiento. Hace falta la app
    instalada en inicio y haber entrado con la cuenta; el permiso se pide al tocar.
  - Hay aviso con una sesión en curso, no cargada después, con un descanso que todavía no
    terminó. Sale a la hora de fin; si cambia el descanso (+15 s, −15 s, otra serie) o lo que
    sigue, se reprograma; si se saltea o se termina o descarta la sesión, se cancela.
  - Empezar la serie siguiente sin tocar Saltar no lo cancela: el descanso sigue corriendo.
  - "Terminó el descanso" y abajo "Sigue Prensa · serie 3 de 3" (al ejercicio le quedan
    series), "Sigue <el siguiente con series>" o "Terminaste todos los ejercicios".
  - Llega aunque la app esté a la vista. Al volver a la app se borran las del descanso. Al
    tocarla vuelve a la app donde estaba; si iOS la cerró, abre el ejercicio del descanso.
  - Un solo aviso por descanso. Si el push service no lo entrega en 60 s, se pierde.
  - Sin señal no se programa; se manda el estado actual al abrir la app, al volver a primer
    plano y al recuperar señal. Cada dispositivo con el aviso prendido avisa los descansos que ve.
- **Carga tardía:** se puede cargar una sesión con fecha pasada. El día se sugiere según
  la rotación a esa fecha. "Hoy toca" y la semana del mesociclo se recalculan con la fecha
  de cada sesión. En la carga no hay descanso ni Wake Lock.
  - Fechas: desde el inicio del mesociclo 1 hasta ayer. No se puede con una sesión en curso.
  - La sesión toma el mesociclo, la semana y el plan de esa fecha, queda marcada `backfilled`
    y al terminarla se ordena al final de ese día. La vez anterior solo mira lo anterior a
    esa fecha. En el historial dice "cargada después" en vez de la duración.
- **Test de banca:** en Upper A de la semana 5 aparece el aviso "banca primero y pesada".
- **Unilaterales:**
  - Va primero el lado débil: extensión, izquierda; curl femoral, derecha. Donde la rutina
    no lo indica es indistinto, y se muestra la izquierda primero.
  - El segundo lado iguala las reps del primero, sin hacer más.
  - El descanso arranca al completar el segundo lado.
- **Cargas:**
  - Unidad por ejercicio: kg (default), lb o ladrillos. Se cambia desde el ejercicio.
  - Cada serie guarda el valor y la unidad con la que se anotó: cambiar la unidad no
    reescribe el pasado.
  - lb se convierte a kg para comparar y para el volumen. Los ladrillos solo se comparan
    con ladrillos y no suman al volumen en kg.
  - El incremento mínimo va en la unidad del ejercicio (en ladrillos, 1).
  - Un solo gimnasio: la máquina queda implícita en el ejercicio.
  - Mancuernas: peso por mancuerna. Ab wheel: sin carga, solo reps.
  - El peso corporal va siempre en kg.
- **Cuerpo:**
  - Peso diario, con promedio por semana de lunes a domingo y comparación con la semana
    anterior. Objetivo +0,25 kg/semana; aviso si pasa +0,4 tres semanas seguidas.
    - Un pesaje por día; se carga o edita el de hoy y el de ayer.
    - Hasta dos decimales en pesajes, promedios y cambio semanal (74,05; +0,25). El stepper
      suma de a 0,05; escribiendo se aceptan dos decimales y se redondea.
    - Los dos gráficos tienen rango: 5 sem, 3 meses (13 semanas) o Todo, de lunes a hoy,
      compartido entre Diario y Semanal; arranca en 5 sem. El objetivo del semanal arranca en el
      primer promedio visible; la escala la definen los promedios y el objetivo se corta arriba.
    - "Ver todos los pesajes" abre la lista por semana (lun–dom), la más nueva arriba, con su
      promedio y el cambio si se puede comparar. Solo para ver.
    - Una semana necesita 3 pesajes para compararse y para el aviso. El aviso mira solo
      semanas terminadas.
  - Cintura semanal: se guardan las 3 mediciones y el promedio se calcula. Se compara con la
    última de la semana anterior y con la primera de todas.
  - Muslo, pantorrilla, brazo, pecho y hombros: una vez por mes, un valor cada una (siempre
    el mismo lado). "Toca medir" a los 30 días de la última.
- **Export** (Ajustes › Datos):
  - JSON: el respaldo completo, tal cual está en el teléfono, sin la marca `pending` y sin las
    sesiones descartadas ni sus series. La sesión en curso entra.
  - CSV: una fila por serie hecha de las sesiones terminadas (también con pendientes o
    cargadas después), en orden cronológico y, dentro de la sesión, por orden de slot. Peso y
    unidad como se anotaron (sin convertir); técnica solo si se hizo. Encabezados y valores en
    español; coma como separador, punto decimal, UTF-8 con BOM.
- **MCP remoto:**
  - "Hoy" es la fecha de Buenos Aires: el Worker corre en UTC.
  - Lee estado, rutina de una semana, catálogo, sesiones, una sesión, historial de un
    ejercicio (por id o nombre; si hay varios, devuelve los candidatos) y cuerpo.
  - Escribe con las reglas de la app: peso (hoy o ayer), cintura y circunferencias (hoy) y la
    nota de una sesión terminada. Va con `updated_at` = ahora y el teléfono lo baja en el
    próximo sync. Sesiones, series y mesociclos solo se tocan desde la app.

## Trampas de iOS (PWA instalada)
- **No hay Background Sync.** El sync corre al abrir la app, en `visibilitychange`, en
  `online`, unos segundos después de cada escritura y al terminar la sesión.
- **No hay notificaciones locales programadas.** El aviso de fin de descanso necesita un
  server: lo programa el Worker con una alarma de Durable Object.
- **Cada push tiene que mostrar una notificación.** Si uno llega y no se ve nada, iOS revoca la
  suscripción. Por eso no se puede "cancelar con un push" ni callar el aviso con la app a la
  vista: se cancela en el server. El mensaje es declarativo (`web_push: 8030`, iOS 18.4+): iOS
  lo muestra aunque el service worker no corra; `mutable` se lo pasa igual al service worker.
- **El permiso de notificaciones solo se pide dentro de un toque**, con la app instalada en
  inicio: `Notification.requestPermission()` va antes de cualquier `await`.
- **El navegador integrado de la app de Claude no tiene service worker ni notificaciones:** el
  push se prueba en Chrome (localhost) o en el iPhone.
- **Borrar el ícono de inicio borra IndexedDB.** Pedir `navigator.storage.persist()`.
  Supabase es el backup.
- **Cambiar de dominio es una instalación nueva** (otro origen, otro almacenamiento).
- **El magic link abre Safari, no la PWA**: por eso el login es con contraseña.
- **El teclado decimal en es-AR trae coma:** el parseo acepta `62,5` y `62.5`. Mostrar con
  `Intl.NumberFormat('es-AR')`.
- **Inputs con `font-size` ≥ 16 px**, o iOS hace zoom.
- **Barra de estado en modo claro:** `apple-mobile-web-app-status-bar-style` va en `default`.
  Con `black-translucent` el texto de la hora queda blanco sobre fondo claro.
- **El panel de la serie edita un borrador local** y lo guarda en segundo plano. Si se lee
  el valor de la base en cada toque, varios "+" seguidos se pisan (ya pasó).
- **Toda escritura de `actions.ts` lleva `stamp()`** (`updatedAt` + `pending: 1`) y
  llama a `scheduleSync()`. Una escritura sin marca nunca se sube. El sync escribe sin
  marca, a propósito (lo que baja ya está al día).
- **Nada de llamadas a Supabase dentro de `onAuthStateChange`**: puede trabar el cliente. Se
  difieren con `setTimeout`.
- **El service worker se registra desde la raíz** (`main.tsx`). Si vive en una pantalla, la
  app abierta directo en la sesión no queda disponible sin conexión (ya pasó).
- **Los títulos no saltan entre pestañas:** `Page` reserva siempre la línea del
  antetítulo (`eyebrow`), aunque esté vacía.
- **Wake Lock se libera al ocultarse la app:** volver a pedirlo en `visibilitychange`.
- **Supabase gratis pausa el proyecto tras 7 días sin actividad.** Se reactiva desde el
  dashboard; la app sigue andando sin conexión.
- **La hoja de compartir solo abre dentro del toque:** `navigator.share` después de un `await`
  falla. El export arma el archivo con datos que ya están en memoria (`useExportData`).
- **El service worker no sirve `index.html` en las rutas del Worker**
  (`navigateFallbackDenylist`): si no, el login del MCP abierto en Safari mostraría la app.

## UI
- **El diseño manda:** [lienzos](https://claude.ai/artifact/JjepiWviYnpoD3prTXjbmP).
  Modo claro, único. Tokens de color, tipo y radios: los de la hoja "Sistema visual".
  Pasan al tema de Tailwind; **cero hex sueltos** en componentes.
- **El panel inferior es la superficie de control:** los steppers, los toggles y el botón
  de completar de la serie actual van abajo, al alcance del pulgar. Las filas de arriba
  son el registro.
- **Números:** en SF Rounded tabular (`ui-rounded`). Toques de 44 pt como mínimo; botón
  principal de 56 pt.
- **Toda operación async tiene indicador visible.** Para cargar, skeletons, nunca
  spinners. El estado vacío lleva una acción; el estado de error lleva "Reintentar".
- **Pantallas anchas (la Mac):** la app es una columna de `max-w-app` (402 px, el ancho del
  iPhone 17) centrada, sin pantallas aparte.
  - Todo lo `fixed` se acota a la columna: `mx-auto max-w-app` si va de borde a borde,
    `mx-auto max-w-[calc(var(--container-app)-2rem)]` si flota a 16 px del borde.
  - Las hojas pasan a modal centrado desde `sm` y se cierran con un clic afuera.
  - Hover y manito salen de una regla global en `index.css`, solo con mouse (`hover: hover`).
- **Textos:**
  - Voseo. Si salió bien, decí qué pasó; si falló, hacete cargo y decí qué hacer.
  - Sin emojis y sin "exitosamente".
  - Nada técnico en pantalla.

## Idioma
- **Código en inglés:** identificadores, archivos, carpetas, rutas, comentarios, títulos de
  tests, ids del catálogo, valores de enums, claves de `routine.json` y nombres de tablas y
  columnas.
- **Pantalla en español:** todo lo que se ve (textos, `aria-label`, nombres de ejercicios en
  `routine.json`). Un valor de enum que se muestra pasa por un mapa a su etiqueta en español
  (`TECHNIQUE_LABEL`, unidad, cadencia `slow`); nunca se muestra el valor crudo.
- **Docs en español** (`CLAUDE.md`, `docs/decisiones.md`). **Commits en inglés.**

## Tests
- **Toda lógica de dominio lleva tests.** Antes de implementar una regla con casos
  discretos (rotación, firma, progresión), se escribe la tabla de casos y se muestra.
- **La pregunta es "¿qué bug atrapa este spec?"** Sin respuesta, no se escribe: un spec que
  repite una constante no prueba nada.
- **La suite queda verde.** Si un test rompe, se reporta con la salida real, no se
  "arregla" el test.

## Flujo de trabajo
- Una rama por fase, desde `main`, y un PR que mergea Gonza.
- El repo vive en la cuenta **personal** de GitHub. El remoto usa el alias SSH `github-gym`
  (`git@github-gym:gruizmdq/gym.git`, clave `~/.ssh/id_ed25519_gym`). La otra cuenta
  configurada en esta Mac (`gruiz-flyingheads`, también la del conector de GitHub) no se
  usa en este repo.
- Commits atómicos. `main` despliega solo si pasan los tipos, el lint, los tests y el build.
- Nunca reescribir historia (rebase, reset --hard, amend, push --force).
