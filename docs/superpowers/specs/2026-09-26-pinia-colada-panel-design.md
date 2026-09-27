# Pinia Colada, tramo 1: el panel

**Fecha:** 2026-09-26 · **Rama:** `mejoras/librerias` · **Estado:** aprobado en conversación, pendiente de revisión escrita

## Objetivo

Reemplazar la carga de datos hecha a mano del panel (`/panel`) por [Pinia Colada](https://pinia-colada.esm.dev/) 1.4.x, la capa de datos oficial del equipo de Pinia. Este tramo fija el patrón que seguirán los siguientes (sala del torneo, administración, listados), y en él se deja de mantener a mano la caché de prefetch y la protección contra respuestas fuera de orden de los widgets.

El ahorro de líneas de este tramo es pequeño (unas 30–40 netas). El ahorro grande llega en los tramos de la sala y la administración, donde los stores de Pinia hoy solo guardan respuestas del servidor.

## Alcance

**Incluye**

- `lib/useWidgetData.ts`: pasa a ser un adaptador sobre `useQuery`, con la misma API pública.
- `views/dashboard/PanelView.vue`: la lista de widgets y jugadores se carga con `useQuery`.
- `router/index.ts`: el `beforeEnter` de `/panel` precarga con la caché de Colada.
- `lib/routeData.ts`: pierde las claves `panel` y `widget`.
- `lib/pageData.ts`: pierde `loadDashboard`.
- Nuevo `lib/dashboardQueries.ts`: las definiciones de las queries del panel.

**No incluye**

- Los 11 componentes de widgets: no se tocan.
- La sala del torneo, la administración del torneo y los listados, que son tramos posteriores. `routeData` sigue sirviendo a `room` y `tournamentAdmin` hasta entonces.
- El editor de layouts del administrador (`DashboardLayoutsView`).

## Decisiones

| Decisión | Motivo |
|---|---|
| Pinia Colada, no TanStack Query | Medido con esbuild (minificado + gzip, sin Vue ni Pinia): 3.7 kB frente a 11.4 kB. Se apoya en el Pinia que ya usa la app. |
| **Sin** instalar el plugin global `PiniaColada` | `useQuery` lee sus opciones con `inject(KEY, USE_QUERY_DEFAULTS)`, así que funciona sin el plugin. Si cada query declara sus opciones, Colada solo entra en el chunk del panel y **el bundle inicial no crece**. |
| Opciones fijadas en cada query: `staleTime: 15_000`, `refetchOnWindowFocus: false` | Conservan el comportamiento actual: los 15 s de frescura de `routeData` y ninguna petición nueva al volver a la pestaña. |
| El id del usuario forma parte de cada clave | En un computador compartido (laboratorio), quien inicia sesión después no ve el panel en caché de la persona anterior. No hace falta acoplar el store de auth a Colada para vaciar la caché al cerrar sesión. |
| `useWidgetData` conserva su API (`data`, `loading`, `error`, `reload`) | Los widgets y `WidgetCard` no cambian; sus tests actuales son la red de seguridad del cambio. |

## Diseño

### `lib/dashboardQueries.ts` (nuevo)

Un único lugar con las queries del panel:

- `panelQuery(userId)`: clave `['dashboard', userId]` y función `getDashboard()`.
- `widgetQuery(userId, key, playerId)`: clave `['dashboard', userId, 'widget', key, playerId ?? '']` y función `getWidgetData(key, playerId)`.
- Ambas llevan `staleTime: 15_000` y `refetchOnWindowFocus: false`, en una constante compartida del módulo.
- `prefetchPanel()` y `prefetchWidget(key, playerId)`: `queryCache.refresh(queryCache.ensure(...))`, con el usuario actual del store de auth. Se usan desde el router y desde `PanelView`.

El router importa este módulo de forma diferida, como hoy hace con `pageData`, para que ni Colada ni los servicios del panel entren en el bundle inicial.

### `useWidgetData` (adaptador)

Misma firma: `useWidgetData<T>(key, subject?)` y `usePlayerWidgetData<T>(key)`. Por dentro:

- `useQuery` con la clave reactiva de `widgetQuery`, deshabilitado (`enabled: false`) cuando el widget es de un jugador y no hay jugador elegido.
- `data`: los datos de la entrada actual, o `null`.
- `loading`: `true` mientras no hay datos que mostrar y hay una petición en curso o por empezar. Es `false` cuando la query está deshabilitada (no hay jugador).
- `error`: el mensaje de `extractErrorMessage(error, t("panel.widgetError"))` cuando la última petición falló y no hay otra en curso; `null` en cualquier otro caso. Durante un reintento, el widget vuelve a mostrar el esqueleto de carga, como hoy.
- `reload`: `refetch()` de la entrada actual.
- `prefetchWidgetData` se retira de este módulo; su papel lo cumple `prefetchWidget` de `dashboardQueries`.

Como cada combinación de jugador y widget es una entrada distinta de la caché, una respuesta lenta para el jugador anterior cae en su propia entrada y nunca se muestra para el nuevo. Eso reemplaza el contador `latestRequest`.

### `PanelView`

- `useQuery(panelQuery(userId))` reemplaza `onMounted`, `takeData`, `loading` y `loadError`.
- `widgets` (filtrados con `isRenderableWidget`) y `selection.players` se derivan de los datos de la query.
- El error de carga usa `extractErrorMessage(error, t("panel.loadError"))`, igual que hoy.
- `LazyMount @visible` llama a `prefetchWidget(widget.key, playerId)` con la misma regla actual: un widget de jugador sin jugador no pide nada.

### Router

El `beforeEnter` de `/panel` pasa a ser `() => import("../lib/dashboardQueries").then((queries) => queries.prefetchPanel())`, con errores silenciados como hoy: la página mostrará el error al leer la query.

### Retiros

- `DATA_KEYS.panel` y `DATA_KEYS.widget` en `routeData.ts`.
- `loadDashboard` en `pageData.ts`.
- `prefetchWidgetData` y el uso de `takeData` en `useWidgetData.ts`.

## Comportamiento que se conserva

Cada punto ya tiene un test que debe seguir pasando sin cambiar lo que verifica:

- Un widget pide sus datos cuando se acerca a la vista, en paralelo con su código y no después. Es una sola petición, aunque el prefetch y el widget la pidan. (`PanelView.test.ts`)
- Los widgets de jugador no piden nada hasta que hay un jugador elegido. (`widgets.test.ts`)
- Cambiar de jugador recarga, ignorando una respuesta anterior más lenta. (`widgets.test.ts`)
- Un widget que falla muestra su error con un botón de reintento que vuelve a pedir, y el resto del panel sigue funcionando. (`widgets.test.ts`, `PanelView.test.ts`)
- El jugador elegido vive en la URL (`?jugador=`) y un enlace compartido abre el panel en ese jugador. (`PanelView.test.ts`)
- El estado vacío, el editor de layouts para el administrador y el aviso al entrenador sin jugadores. (`PanelView.test.ts`)

Los tests solo cambian en el montaje, que ahora instala Pinia como plugin de la app porque Colada guarda su caché en un store de Pinia.

## Tests nuevos

- Las claves de `dashboardQueries` incluyen el usuario: dos usuarios distintos no comparten entradas.
- El prefetch del router y la página comparten una sola petición del panel.
- Con la query de un widget deshabilitada (sin jugador), `loading` es `false` y no hay petición.

## Verificación

- Frontend: lint, `vue-tsc`, suite completa y build.
- Medir el bundle inicial antes y después; lo esperado es que no cambie (hoy 83.0 kB, 23.8 kB gzip).
- Prueba de punta a punta con Playwright contra la API real (PostgreSQL local, cuentas del seed):
  - el panel de administrador y el de entrenador cargan sus widgets;
  - cambiar de jugador actualiza los widgets de jugador;
  - no hay errores en consola;
  - al cerrar sesión e iniciar con otra cuenta no aparece el panel anterior.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `prefetchPanel` se ejecuta en el router, fuera de un componente | Usa el store de caché con la Pinia activa (la app ya la activó al instalarla). Lo cubre el test del prefetch del router y la prueba de punta a punta. |
| La semántica de `status`/`asyncStatus` de Colada no coincide 1:1 con `loading`/`error` actuales | El adaptador define `loading` y `error` de forma explícita (ver arriba), y los tests de widgets los verifican, incluido el reintento. |
| Alguna opción por defecto de Colada cambia el comportamiento sin que se note | Las opciones que difieren de hoy (`staleTime`, `refetchOnWindowFocus`) se fijan en cada query. `refetchOnReconnect` queda activo, y es una mejora: al volver la conexión se actualiza el panel. |
