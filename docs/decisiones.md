# Decisiones

Fecha: 2026-11-14 · Estado: aprobadas por Gonza, salvo donde dice "pendiente".
Complementa a `CLAUDE.md`, que dice qué se hace. Acá va el porqué.

Formato: **decisión** · por qué · alternativa descartada · costo de revertir.

## Marco
- Un usuario, un iPhone 17, costo cero de infraestructura.
- Sin cuenta de desarrollador de Apple: es web instalada, no nativa.
- Mejores prácticas aunque el proyecto sea chico, siempre pesando esfuerzo contra
  recompensa.
- La UX es la razón de ser del proyecto: tiene que sentirse app, no web.

## Stack

| # | Decisión | Por qué | Descartado | Revertir |
|---|---|---|---|---|
| 1 | **Vite + React 19 + TS strict + Tailwind v4 + React Router** | Lo estándar para una SPA móvil; ecosistema PWA maduro. | Angular (lo de Solutech): más pesado para una app chica de un usuario. | caro |
| 2 | **Sin Zustand: Dexie + `useLiveQuery`** | El estado que importa ya vive en IndexedDB y se actualiza solo en la UI; un store sería una segunda fuente de verdad. | Zustand: se suma si aparece estado efímero compartido. | barato |
| 3 | **Sync propio: cambios pendientes + gana la última escritura por fila** | Un usuario y datos que casi solo se agregan: unas 300 líneas con tests. | PowerSync, RxDB, Electric, Dexie Cloud: suman un servicio o una dependencia pesada; Dexie Cloud además reemplaza a Supabase y se pierde el MCP. | medio |
| 4 | **Supabase gratis, São Paulo** | Postgres + Auth + RLS, y el MCP oficial deja que Claude consulte con SQL. | Cloudflare D1: sin MCP equivalente para analizar datos. | caro |
| 5 | **Auth con email y contraseña de Supabase** | Los refresh tokens no vencen en el plan gratuito: se entra una vez. RLS nativo con `auth.uid()`. | Magic link: abre Safari, no la PWA. Token de dispositivo propio: reimplementa Supabase con más superficie de error. | barato |
| 6 | **Cloudflare Workers con static assets, en `*.workers.dev`** | Gratis, sin límite de requests estáticos; el MCP remoto (fase 7) vive en el mismo lugar. Dominio común: sin costo. | Vercel: también sirve. Dominio propio: Gonza no quiere pagar. | barato antes de instalar; después, cambiar de dominio es reinstalar |
| 7 | **CI en GitHub Actions; deploy con Cloudflare Workers Builds, que corre el mismo `npm run verify` antes de publicar** | Una rutina inválida nunca llega al teléfono, y no hace falta guardar un token de Cloudflare en GitHub. | Deploy desde Actions con `wrangler-action`: suma un secreto para el mismo resultado. | barato |
| 8 | **Biome** | Una herramienta y una config para lint y formato. | ESLint + Prettier: más piezas para el mismo resultado. | barato |
| 9 | **Vitest + Playwright WebKit para 2 o 3 flujos críticos** | El dominio se prueba en unidades; offline y recarga se prueban con un browser parecido a Safari. | Solo pruebas manuales en el iPhone. | barato |

## Datos y dominio

| # | Decisión | Por qué | Descartado | Revertir |
|---|---|---|---|---|
| 10 | **La versión de la rutina es el hash del contenido** | Cualquier cambio genera versión nueva sin depender de acordarse de subir un número. | Campo `version` manual. | barato |
| 11 | **Planes con los días completos, sin herencia** | Es más fácil de editar (también para Claude) y de validar que una lógica de overrides. | "El 4d es el 5d con estos cambios". | barato |
| 12 | **Unilateral = ejercicio propio del catálogo** (corregida en la fase 2; antes era un dato de la firma) | La extensión bilateral y la unilateral no se pueden comparar, y como el historial sigue al ejercicio, tampoco tienen que mezclarse en sus gráficos. | Un flag "unilateral" en el slot y en la firma: mezclaba los dos en el historial del ejercicio. | barato |
| 13 | **La descarga no es referencia ni cuenta para progresión** | Son las mismas cargas con la mitad de series: no mide progreso. | Tratarla como una semana más. | barato |
| 14 | **Solo el Día 5 se puede saltear, con un botón** | "No se saltea, se rota"; el Día 5 es el complementario (PDF). | Saltearlo automáticamente al cambiar la semana calendario: es más sorpresivo. | barato |
| 15 | **Descarga: mitad de series redondeando para arriba** | Decisión de Gonza. | Redondear para abajo. | barato |
| 16 | **Cintura: se guardan las 3 mediciones** | El promedio se deriva; las mediciones crudas no cuestan nada. | Guardar solo el promedio. | barato |

## UX

| # | Decisión | Por qué | Descartado | Revertir |
|---|---|---|---|---|
| 17 | **Modo claro, único** | Preferencia de Gonza. | Oscuro por defecto (pedido original). | barato con tokens |
| 18 | **Panel inferior como superficie de control de la serie actual** | Uso con una mano: todo lo que se toca en cada serie queda al alcance del pulgar. | Steppers y toggles en cada fila: se aprieta todo y queda lejos del pulgar. | medio |
| 19 | **Teclado nativo (`inputmode`) al tocar el número** | Es lo pedido. Si en el gimnasio se siente torpe, se evalúa un teclado propio después de la fase 3. | Teclado numérico propio desde el principio. | medio |
| 20 | **Tab bar flotante con 4 secciones: Hoy, Historial, Cuerpo, Ajustes** | Acompaña el lenguaje de iOS 26. En la sesión activa no hay tab bar: es pantalla completa. | Tab bar pegada al borde. | barato |
| 21 | **"Cadencia ok" viene marcada; un toque la desmarca** | Cansado, es fácil olvidarse de marcarla, y eso bloquearía las sugerencias de progresión. Aprobado con los lienzos. | Desmarcada por defecto. | barato |
| 22 | **Fin del descanso solo visual** | Decisión de Gonza. Safari no vibra y el sonido depende del modo silencio. | Pitido corto + visual. | barato |

## Después de los lienzos (14/11/2026)

| # | Decisión | Por qué | Descartado | Revertir |
|---|---|---|---|---|
| 23 | **Unidad de carga por ejercicio: kg (default), lb o ladrillos. Cada serie guarda su unidad** | Hay máquinas en libras y máquinas viejas donde se cuentan ladrillos. Guardar la unidad en la serie hace que un cambio no reescriba el pasado. | Unidad global: los ladrillos no tienen sentido global. Por serie: un toque más en cada serie. | medio |
| 24 | **lb se convierte a kg; los ladrillos no** | Un ladrillo pesa distinto en cada máquina: solo se compara con ladrillos y queda fuera del volumen en kg. | Configurar kg por ladrillo: nadie lo pidió. | barato |
| 25 | **Un solo gimnasio** | Gonza entrena siempre en el mismo: la máquina queda implícita en el ejercicio. | Registrar el gimnasio en cada sesión. | medio (habría que agregarlo a la firma) |
| 26 | **El historial sigue al ejercicio, no al lugar en la rutina. Ids de catálogo estables** | Al cambiar de rutina o reemplazar un ejercicio, el historial tiene que seguir sirviendo para comparar. | Comparar con lo que había en ese lugar de la rutina. | caro (ids estables desde el día 1) |
| 27 | **Terminar con pendientes cuenta como hecha** | "Cumplir sesiones" es la prioridad 1; repetir el mismo día desarma la semana. | Que no cuente y se repita el día. | barato |
| 28 | **Sin series de aproximación** | Menos toques; no entran en ningún cálculo. | Anotarlas aparte. | barato |
| 29 | **Carga tardía con fecha pasada** | Decisión de Gonza: si un día no anotó, lo carga después. Obliga a que la rotación y la semana se calculen con la fecha de cada sesión. | Solo editar sesiones existentes. | barato |
| 30 | **Test de banca: aviso en Upper A de la semana 5; el orden de la sesión es libre** | El PDF lo pide en la última semana cargada; el orden libre ya permite hacer la banca primero. | Reordenar la sesión sola. | barato |

## Fase 1 (14/11/2026)

| # | Decisión | Por qué | Descartado | Revertir |
|---|---|---|---|---|
| 31 | **El repo va en la cuenta personal de GitHub, por SSH con una clave y un alias propios** | En esta Mac ya está logueada otra cuenta (`gruiz-flyingheads`); el alias `github-gym` aísla la personal sin tocar la otra. | Token HTTPS en el llavero. | barato |
| 32 | **Actualización con aviso (`registerType: 'prompt'`), sin recarga automática** | Una recarga a mitad de una serie sería un mal momento; se aplica cuando Gonza toca Actualizar. | `autoUpdate`. | barato |
| 33 | **Paleta de Tailwind borrada: solo existen los tokens del diseño** | "Cero hex sueltos" lo verifica el compilador de clases, no la revisión. | Convivir con la paleta default. | barato |
| 34 | **Versiones al día: Vite 8, TypeScript 7, React Router 8, Vitest 5** | Proyecto nuevo: arrancar en lo vigente evita una migración apenas empieza. | Versiones anteriores "probadas". | medio |

## Fase 3 (14/11/2026)

| # | Decisión | Por qué | Descartado | Revertir |
|---|---|---|---|---|
| 35 | **Sin historial: peso vacío y reps en el piso del rango; no se puede completar sin peso** | Inventar un peso sería peor que pedirlo. | Prellenar desde la referencia secundaria (otro día): otro contexto. | barato |
| 36 | **Cambiar el peso de una serie lo lleva a las pendientes que siguen (mismo lado)** | Es lo que pasa en el gimnasio: si subís, subís todas. | Cada serie independiente. | barato |
| 37 | **El descanso también corre después de la última serie del ejercicio** | Es el descanso antes del ejercicio siguiente. | Cortarlo al terminar el ejercicio. | barato |
| 38 | **Las reps de la técnica no suman al volumen** | En el drop set el peso ya no es el mismo; mejor subestimar que inventar. | Sumarlas con el peso de la serie. | barato |
| 39 | **La técnica va en la última serie, contando las agregadas** | "Siempre en la última serie". | Fijarla en la última prescripta. | barato |
| 40 | **Series guardadas con id determinístico (`session:slot:exercise:number:side`)** | Cada toque es un `put` idempotente: sin búsquedas ni duplicados, y listo para sincronizar. | Ids aleatorios. | medio |

## Fase 4 (14/11/2026)

| # | Decisión | Por qué | Descartado | Revertir |
|---|---|---|---|---|
| 41 | **Cursor de pull = secuencia de Postgres asignada por trigger** | No depende del reloj del teléfono; nunca se saltea un cambio. | `updated_at > último visto`: dos escrituras en el mismo instante o un reloj corrido pierden filas. | caro |
| 42 | **Gana la última escritura por fila, con la hora del teléfono; el trigger ignora versiones más viejas** | Un usuario y casi siempre un teléfono: los conflictos reales son raros y así se resuelven solos. | Merge por campo o CRDT: complejidad sin un caso que lo pida. | medio |
| 43 | **Marca de pendiente explícita en `acciones.ts`, sin hooks de Dexie** | Es explícito y se testea; los hooks no distinguen fácil una escritura propia de una que baja del servidor. | Hooks `creating`/`updating`. | barato |
| 44 | **Supabase local en Docker para probar** | La única forma de probar RLS, triggers y login de verdad antes de tocar el proyecto real. | Probar solo con dobles. | barato |
| 45 | **URL y clave publicable en `.env` commiteado** | Son públicas por diseño; evita configurar variables en Cloudflare. | Variables de entorno en Cloudflare. | barato |
| 46 | **Login ofrecido una vez al abrir y después desde Ajustes; sin signup en la app** | Hay un solo usuario y se crea a mano; la app sigue andando sin cuenta. | Login obligatorio. | barato |
| 47 | **Cron semanal en Actions contra `public.heartbeat()`** (antes `latido()`) | El plan gratuito pausa el proyecto tras 7 días sin actividad. | Reactivarlo a mano desde el dashboard. | barato |

## Código en inglés (14/11/2026)

| # | Decisión | Por qué | Descartado | Revertir |
|---|---|---|---|---|
| 48 | **Todo el código en inglés: identificadores, archivos, rutas, comentarios, tests, ids del catálogo, valores de enums, claves de `routine.json`, tablas y columnas** | Pedido de Gonza: no tolera código en español. Se hizo antes de tener datos reales, así que los ids y las tablas se pudieron renombrar sin migrar nada. | Solo identificadores; o dejar la base en español con un mapeo. | caro: desde acá los ids quedan congelados |
| 49 | **La pantalla, `CLAUDE.md` y `decisiones.md` siguen en español; los commits van en inglés** | La app es para Gonza; los docs también. | Todo en inglés. | barato |
| 50 | **Un valor de enum nunca se muestra crudo: pasa por un mapa a su etiqueta** (`TECHNIQUE_LABEL`, unidad, cadencia `slow` → "lenta") | Los valores en inglés no pueden llegar a la pantalla. | Dejar los valores en español. | barato |
| 51 | **Dexie pasa por la versión 4 (borra las tablas) y la 5 (las crea en inglés); Supabase recibe una migración que borra las tablas vacías y las crea con los nombres nuevos** | No había datos: copiar no aportaba nada. Dexie no puede cambiar una clave primaria en el lugar (la de `meta` cambiaba), por eso hace falta la 4; la 5 además siembra el mesociclo 1, que `populate` solo crea en una base nueva. La primera migración queda como historia (ya está aplicada). | Migrar filas; reescribir la primera migración (obliga a reparar el historial remoto). | barato |

## Fase 5 (14/11/2026)

| # | Decisión | Por qué | Descartado | Revertir |
|---|---|---|---|---|
| 52 | **Retroceso = peso tope y, a igual peso, reps a ese peso** | Subir de peso y volver al piso nunca cuenta como bajar, que es justo lo que pide la doble progresión. | 1RM estimado y volumen: los dos dan falsa alarma después de subir de peso. | barato |
| 53 | **La cadena de retroceso cruza mesociclos** | Decisión de Gonza. La descarga nunca cuenta. | Solo dentro del mismo mesociclo (evitaba el aviso en la semana 1). | barato |
| 54 | **Sin sugerencia de subir en la semana 1 ni en la descarga** | En calibración se buscan las cargas para RIR 2–3; la referencia suele ser la semana 5, a RIR 1. | Sugerir en todas las semanas de trabajo. | barato |
| 55 | **Las series agregadas a mano no cuentan ni para subir ni para el retroceso; una sesión con series de menos no entra en la cadena** | La serie extra de las semanas 4–5 suele salir con menos reps y bloquearía la progresión o daría falsa alarma. | Contar todas las series hechas. | barato |
| 56 | **"Para la próxima" del resumen: los que suben y los que quedaron a exactamente 1 rep** | Como en el lienzo: la lista queda corta y muestra lo que está por pasar. Una serie sin cadencia no es "a 1 rep". | Todos los ejercicios; solo los que suben. | barato |
| 57 | **El aviso de subir se aplica con un toque y el estado "aplicado" se deriva de los pesos** | Es una sugerencia: no cambia nada solo. Derivarlo evita guardar una marca más. | Guardar si se aplicó. | barato |

## Fase 6 (15/11/2026)

| # | Decisión | Por qué | Descartado | Revertir |
|---|---|---|---|---|
| 58 | **Una semana necesita 3 pesajes para compararse y contar para el aviso de +0,4** | Con 1 o 2, un día con agua o sal mueve demasiado el promedio. | Contar cualquier semana; pedir 4. | barato |
| 59 | **El aviso de +0,4 mira solo semanas terminadas** | La semana en curso cambia día a día: el aviso aparecería y desaparecería. | Incluir la semana en curso. | barato |
| 60 | **El peso se carga o edita hoy y ayer; más atrás no** | Cubre el olvido habitual sin agregar un selector de fecha. | Solo hoy; cualquier fecha. | barato |
| 61 | **Circunferencias: las 5, un valor cada una, "Toca medir" a los 30 días** | Medir siempre del mismo lado alcanza para ver la tendencia. | Ambos lados en las de a pares. | barato |
| 62 | **Carga tardía desde el inicio del mesociclo 1 hasta ayer; no con una sesión en curso** | Antes del arranque no hay mesociclo ni semana que asignar. Una sola sesión en curso a la vez. | Cualquier fecha; un límite de 14 días. | barato |
| 63 | **Una sesión cargada después se ordena al final de su día y su vez anterior solo mira lo anterior a esa fecha** | Así la rotación, el resumen y el prellenado la tratan como si se hubiera hecho ese día. | Ordenarla por el momento en que se cargó. | medio |
| 64 | **Historial: "n de m" cuenta el Día 5 salteado; el historial de un ejercicio se agrupa por día de rutina** | El Día 5 salteado cuenta para la rotación. Por día de rutina se ve el progreso comparable; otra prescripción del mismo día aparece como "No equivalente". | Agrupar por firma exacta. | barato |

## Fase 7 (15/11/2026)

| # | Decisión | Por qué | Descartado | Revertir |
|---|---|---|---|---|
| 65 | **Export: el JSON es el respaldo completo; el CSV, una fila por serie hecha** | Como en el lienzo (Ajustes › Datos). El CSV es para una planilla; el cuerpo queda en el JSON. | Un segundo CSV con el cuerpo. | barato |
| 66 | **El export se arma con datos ya en memoria y se comparte con la hoja de iOS; si no se puede, se descarga** | iOS solo abre la hoja si `navigator.share` se llama dentro del toque, sin esperar a IndexedDB. | Leer IndexedDB al tocar: la hoja fallaría. Una hoja intermedia con "Compartir": un toque más. | barato |
| 67 | **El MCP remoto vive en el mismo Worker que la app** | Un deploy y un dominio. `run_worker_first` deja los archivos de la app fuera del Worker. | Un Worker aparte: otro deploy y otra URL. | barato |
| 68 | **OAuth con el login de Supabase; escribir la contraseña es el consentimiento** | Decisión de Gonza: tiene que andar en la app de Claude, que necesita OAuth. Sin una sesión propia del Worker no hay nada que falsificar desde otro sitio. La página muestra el cliente y a qué host va el acceso. | Token en el header: solo sirve en Claude Code. URL secreta: si se filtra, se leen los datos. | medio |
| 69 | **El MCP lee y escribe como Gonza: su sesión de Supabase va cifrada en el grant y aplica RLS** | No hay ningún secreto de Supabase en Cloudflare. El token de acceso vive menos que el de Supabase, y al refrescarlo se refresca la sesión. Si Supabase la rechaza, el grant se revoca y Claude pide entrar de nuevo. | `service_role` como secreto del Worker, filtrando por `user_id` en el código. | medio |
| 70 | **Escrituras: peso, cintura, circunferencias y notas, con las reglas de la app** | Decisión de Gonza. Sesiones, series y mesociclos tienen reglas (rotación, firma, inicio del mesociclo) que viven en la app. | Solo lectura. | barato |
| 71 | **Un proveedor OAuth por origen** | La URL del MCP va dentro de cada token: así anda en workers.dev, en las previews y en localhost sin configurar la URL. | Fijar la URL en `wrangler.jsonc`. | barato |
| 72 | **SDK de MCP v2 (`@modelcontextprotocol/server`) sin estado, y `@cloudflare/workers-oauth-provider`** | El SDK v2 trae soporte para Workers y pocas dependencias. Sin estado no hacen falta Durable Objects. | El paquete `agents` de Cloudflare: más pesado para lo mismo. | barato |
| 73 | **`verify` también empaqueta el Worker (`wrangler deploy --dry-run`)** | Un error de bundle del MCP aparece en el PR y no recién en el deploy. | Dejarlo para Workers Builds. | barato |

## Pendiente
- **Import de Hevy (fase 7), en pausa:** falta el `workouts.csv` real de Gonza; no hay
  documentación oficial de las columnas. Ya decidido: los ejercicios de Hevy que no están en
  el catálogo se agregan a `routine.json` como ejercicios sin slot, con id estable. Si el
  título del entreno corresponde a un día de la rutina, la sesión es referencia "no
  equivalente" de ese día y prellena la semana 1. Solo entrenamientos (no las mediciones).
  Con el archivo: tablas de casos (series de aproximación, drop sets, unilaterales, fechas,
  duplicados al importar dos veces, rotación) y después el código.
- **Primer deploy con el Worker:** confirmar que Workers Builds crea el KV `OAUTH_KV`. Si
  falla por permisos, se crea en el dashboard y su id va en `wrangler.jsonc`. Después,
  conectar Claude con `https://gym.<subdominio>.workers.dev/mcp`.
- **Probar la fase 1 en el iPhone** después del primer deploy: barra de estado, splash,
  tab bar sobre la barra de inicio y modo avión.
- **Proyecto real de Supabase** (`wuampfwqeqbqbbxdqzzq`, MCP ya configurado): clave publicable
  en `.env`, las dos migraciones aplicadas y usuario creado. Falta confirmar que los signups
  estén apagados.
