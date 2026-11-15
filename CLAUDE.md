# Gym — PWA personal de entrenamiento

App web para registrar entrenamientos de gimnasio. Un solo usuario (Gonza), instalada
como PWA en un iPhone 17 ("Agregar a inicio"). Reemplaza a Hevy. Offline first.
Interfaz en español rioplatense, unidades en kg.

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
  persistente, estado en Hoy y Ajustes, latido semanal. Probado contra Supabase local. Falta el
  proyecto real: `.env` con URL y clave publicable y `supabase db push`.

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
- `npm run verify`: lint (Biome) + tests (Vitest) + build (`tsc -b` + Vite). Es exactamente
  lo que corren CI y el deploy: si pasa local, pasa allá.
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
- **Las versiones nuevas nunca recargan solas:** el service worker nuevo espera y la app
  muestra "Hay una versión nueva" hasta que se toca Actualizar. Además se busca versión
  nueva cada vez que la app vuelve a primer plano.
- La versión que está corriendo (commit corto) se ve en Ajustes.

## Supabase
- `supabase/migrations/` es la verdad del esquema. Se aplica con `npx supabase db push`
  (pide la contraseña de la base: la escribe Gonza en su terminal).
- **Local:** `npx supabase start` levanta todo en Docker (realtime, studio, storage y edge
  apagados en `supabase/config.toml`). `.env.local` (no se commitea) apunta ahí y tiene un
  usuario de prueba que solo existe en local. `npx supabase stop` lo apaga sin borrar datos.
- `.env` (commiteado) tiene la URL y la clave **publicable** del proyecto real: son públicas,
  igual van dentro de la app. La `secret`/`service_role` nunca entra al repo ni a la app.
- Columnas en snake_case con los mismos nombres que la app. Cada tabla: `user_id` con RLS,
  `actualizado_en` (hora del teléfono: gana la más nueva; el trigger ignora una más vieja),
  `eliminado_en` (borrado lógico, sin `delete`) y `secuencia` (cursor del pull).
- **Para analizar los datos:** el MCP `supabase` de `.mcp.json` (proyecto
  `wuampfwqeqbqbbxdqzzq`, `read_only=true`) deja consultar con SQL. Se autentica una vez con
  `/mcp` en Claude Code. Para escribir esquema se usan migraciones, nunca el MCP.
- `public.latido()` existe solo para el cron semanal (`.github/workflows/latido.yml`) que
  evita la pausa del plan gratuito.

## Estructura
```
rutina/rutina.json   la rutina (dato); la valida src/rutina/schema.test.ts
src/dominio/         reglas puras con tests: fechas, mesociclo, rotación, prescripción
src/datos/           Dexie: db.ts (tablas), acciones.ts (toda escritura), consultas.ts (lecturas vivas)
src/features/<x>/    pantallas; entrenamiento/estado.ts junta dominio + datos para Hoy, sesión y Ajustes
src/ui/              piezas sin dominio: Pagina, Hoja (<dialog>), TabBar, formato, botones
src/pwa/             service worker (se registra desde main.tsx, fuera del router) y almacenamiento
src/sync/            el único que habla con Supabase: tablas.ts (mapeo), motor.ts (subir, bajar,
                     resolver), iniciar.ts (cuándo corre, login), estado.ts (lo que ve la UI)
src/features/sesion/modelo.ts   cada slot de la sesión en curso: ejercicio elegido, unidad, firma, progreso
src/features/ejercicio/         la pantalla central: filas, panel inferior y hojas de opciones
```
- Para probar en el navegador sin ensuciar la rotación, descartá la sesión en vez de
  terminarla. Antes del 7/12, terminar una sesión corre el inicio del mesociclo 1 a ese
  día: se vuelve a poner en Ajustes.

## Arquitectura: reglas duras
- **La UI solo habla con Dexie. El único que habla con Supabase es el sync.** Nada de
  fetch a Supabase desde una pantalla.
- **Cada toque se escribe en Dexie al instante.** iOS puede matar la app en cualquier
  momento; no hay estado importante que viva solo en memoria (tampoco el descanso: se
  guarda como timestamp de fin).
- **Dominio puro en `src/domain/`**: sin React, sin Dexie, sin fechas del sistema
  (el "ahora" entra por parámetro). Todo lo de abajo vive ahí y lleva tests.
- **Sync:** ids uuid generados en el cliente; cada fila sincronizable tiene
  `updated_at`, `deleted_at` (borrado lógico) y marca de pendiente. Push = upsert
  idempotente; pull = cambios desde un cursor que asigna el server (secuencia, no el
  reloj del teléfono). Gana la última escritura por fila.
- **Auth:** Supabase email + contraseña, `persistSession` y `autoRefreshToken`. Los
  signups quedan deshabilitados después de crear el usuario. RLS restringe cada tabla a
  `user_id = (select auth.uid())`. La app funciona sin sesión: la sesión solo la usa el
  sync.
- **Rutina:** `rutina/rutina.json`, con la forma de `src/rutina/schema.ts` (Zod). El test
  `src/rutina/schema.test.ts` la valida: si no valida, no hay deploy. Para editarla:
  cambiá el JSON y corré `npm run test`; el error dice qué día, slot y campo fallan.
  La versión es el hash del contenido. Al abrir, la app guarda la versión en
  `routine_versions` (local y Supabase); cada sesión guarda con qué versión se hizo.
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
  del rango con `cadenceOk`, se sugiere subir el incremento mínimo del ejercicio y volver al
  piso. En unilaterales, por lado. Las reps extra de la técnica no cuentan. **Es una
  sugerencia, nunca un cambio automático.**
- **Alerta de retroceso:** si un compuesto retrocede dos sesiones seguidas, se avisa:
  "sacá las técnicas esta semana antes de tocar otra cosa".
- **Sesión:**
  - Orden libre: se puede empezar por cualquier ejercicio.
  - Solo series efectivas: las de aproximación no se anotan.
  - Terminar con ejercicios pendientes cuenta como hecha para la rotación; los que faltaron
    quedan como salteados. Una sesión recién empezada se puede descartar.
  - El fin del descanso es solo visual: el panel cambia de color y cuenta el tiempo de más.
- **Carga tardía:** se puede cargar una sesión con fecha pasada. El día se sugiere según
  la rotación a esa fecha. "Hoy toca" y la semana del mesociclo se recalculan con la fecha
  de cada sesión. En la carga no hay descanso ni Wake Lock.
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
  - Cintura semanal: se guardan las 3 mediciones y el promedio se calcula.
  - Muslo, pantorrilla, brazo, pecho y hombros: una vez por mes.

## Trampas de iOS (PWA instalada)
- **No hay Background Sync.** El sync corre al abrir la app, en `visibilitychange`, en
  `online`, unos segundos después de cada escritura y al terminar la sesión.
- **No hay notificaciones locales programadas.** El aviso de fin de descanso por push
  necesita un server (fase 8).
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
- **Toda escritura de `acciones.ts` lleva `marca()`** (`actualizadoEn` + `pendiente: 1`) y
  llama a `programarSync()`. Una escritura sin marca nunca se sube. El sync escribe sin
  marca, a propósito (lo que baja ya está al día).
- **Nada de llamadas a Supabase dentro de `onAuthStateChange`**: puede trabar el cliente. Se
  difieren con `setTimeout`.
- **El service worker se registra desde la raíz** (`main.tsx`). Si vive en una pantalla, la
  app abierta directo en la sesión no queda disponible sin conexión (ya pasó).
- **Los títulos no saltan entre pestañas:** `Pagina` reserva siempre la línea del
  antetítulo, aunque esté vacía.
- **Wake Lock se libera al ocultarse la app:** volver a pedirlo en `visibilitychange`.
- **Supabase gratis pausa el proyecto tras 7 días sin actividad.** Se reactiva desde el
  dashboard; la app sigue andando sin conexión.

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
- **Textos:**
  - Voseo. Si salió bien, decí qué pasó; si falló, hacete cargo y decí qué hacer.
  - Sin emojis y sin "exitosamente".
  - Nada técnico en pantalla.

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
