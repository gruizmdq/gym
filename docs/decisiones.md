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
| 12 | **Firma con "unilateral"** | La extensión bilateral y la unilateral no se pueden comparar. | Firma sin ese dato. | barato |
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

## Pendiente
- **Usuario de la cuenta personal de GitHub** y el repo vacío `gym` creado ahí.
- **Conectar Cloudflare Workers Builds** al repo (lo hace Gonza desde el dashboard).
