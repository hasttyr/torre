# Pinia Colada en el panel — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la carga de datos hecha a mano del panel (`/panel`) por Pinia Colada, sin cambiar lo que ve el usuario ni el bundle inicial.

**Architecture:** Un módulo `lib/dashboardQueries.ts` define las queries del panel (lista de widgets y datos de cada widget), con el id del usuario en la clave, y las funciones de prefetch. `useWidgetData` pasa a ser un adaptador sobre `useQuery` con la misma API, así que los 11 widgets no cambian. `PanelView` y el `beforeEnter` de `/panel` pasan a usar la caché de Colada, y `routeData`/`pageData` pierden lo del panel.

**Tech Stack:** Vue 3.5, Pinia 4.0.3, `@pinia/colada` 1.4.6, Vue Router 5, Vitest 5 + @vue/test-utils (jsdom), Playwright MCP para la prueba de punta a punta.

**Spec:** [`docs/superpowers/specs/2026-09-26-pinia-colada-panel-design.md`](../specs/2026-09-26-pinia-colada-panel-design.md)

## Global Constraints

- `@pinia/colada` en `^1.4.6` como dependencia de `frontend/`. **No** se instala el plugin `PiniaColada` en `main.ts`.
- Toda query del panel lleva `staleTime: 15_000` y `refetchOnWindowFocus: false`.
- Claves: `['dashboard', userId]` para el panel y `['dashboard', userId, 'widget', key, playerId ?? '']` para cada widget. `userId` es `useAuthStore().user?.id ?? ''`.
- Los prefetch piden siempre al servidor (`queryCache.fetch`) salvo que ya haya una petición en curso para esa entrada (`entry.pending.refreshCall`), que se reutiliza.
- No se modifican los 11 componentes de `components/dashboard/widgets/*.vue` ni `WidgetCard.vue`.
- El chunk inicial (`dist/assets/index-*.js`) no cambia: 83.01 kB (23.84 kB gzip).
- Comentarios de código en inglés; textos y documentación en español. Commits con el estilo del repo (resumen en una línea, cuerpo explicando el porqué) y la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Todos los comandos de frontend se corren desde `frontend/`. Archivos con LF y formateados con Prettier (`npx prettier --write <archivos>`).

## Review Focus

1. **Volver al panel poco después de un cambio.** Alguien registra un resultado en la sala y vuelve al panel antes de 15 s: los widgets deben pedir datos nuevos, no quedarse con la caché. Lo cubren el test "cada visita vuelve a pedir" de la Task 1 y el paso 4 de la prueba de punta a punta de la Task 4.
2. **Cambiar de cuenta en la misma pestaña**, como en un computador compartido del laboratorio: nunca debe aparecer el panel del usuario anterior. Lo cubren el test de claves por usuario de la Task 1 y la prueba de punta a punta de la Task 4.
3. **Volver a la pestaña tras un rato** no debe disparar una ráfaga de peticiones de todos los widgets. Lo cubre el test de opciones de la Task 1.
4. **Doble navegación rápida a `/panel`** (dos prefetch simultáneos): una sola petición. Lo cubre la Task 1.
5. **Fallo del prefetch de la ruta**, por ejemplo un chunk viejo tras un despliegue: la navegación debe completarse y la página resuelve su propia carga. Lo cubre el test nuevo del router en la Task 3.

---

## Mapa de archivos

| Archivo | Responsabilidad | Task |
|---|---|---|
| `frontend/src/lib/dashboardQueries.ts` (nuevo) | Queries del panel, claves por usuario, prefetch | 1 |
| `frontend/src/lib/dashboardQueries.test.ts` (nuevo) | Claves, prefetch compartido, visitas, fallos | 1 |
| `frontend/src/lib/useWidgetData.ts` | Adaptador `useQuery` → `{ data, loading, error, reload }` | 2 |
| `frontend/src/components/dashboard/widgets/widgets.test.ts` | Montaje con Pinia instalada; aserción extra de "sin jugador" | 2 |
| `frontend/src/views/dashboard/PanelView.vue` | Prefetch de widgets (Task 2); lista del panel con `useQuery` (Task 3) | 2, 3 |
| `frontend/src/views/dashboard/PanelView.test.ts` | Montaje con Pinia instalada | 2 |
| `frontend/src/router/index.ts` | `beforeEnter` de `/panel` con `prefetchPanel` | 3 |
| `frontend/src/router/index.test.ts` | Mock de `dashboardQueries`; fallo del prefetch | 3 |
| `frontend/src/lib/routeData.ts` | Quitar `DATA_KEYS.panel` y `DATA_KEYS.widget` | 3 |
| `frontend/src/lib/pageData.ts` | Quitar `loadDashboard` | 3 |
| `docs/arquitectura.md`, `frontend/README.md` | Describir el patrón nuevo | 4 |

---

### Task 1: Queries del panel con Pinia Colada

**Files:**
- Create: `frontend/src/lib/dashboardQueries.ts`
- Test: `frontend/src/lib/dashboardQueries.test.ts`
- Modify: `frontend/package.json`, `frontend/package-lock.json` (dependencia)

**Interfaces:**
- Consumes: `getDashboard(): Promise<Dashboard>` y `getWidgetData<T>(key: WidgetKey, playerId?: string): Promise<T>` de `services/dashboard.ts`; `useAuthStore().user?.id`.
- Produces:
  - `panelQuery(userId: string): DefineQueryOptions<Dashboard>`
  - `widgetQuery<T>(userId: string, key: WidgetKey, playerId: string | null): DefineQueryOptions<T>`
  - `currentUserId(): string`
  - `prefetchPanel(): void`
  - `prefetchWidget(key: WidgetKey, playerId: string | null): void`

- [ ] **Step 1: Instalar la dependencia**

Run: `npm install @pinia/colada@^1.4.6`
Expected: se instala sin errores de peer (el proyecto ya tiene `vue` 3.5 y `pinia` 4). `grep -n "@pinia/colada" package.json` muestra `"@pinia/colada": "^1.4.6"`.

- [ ] **Step 2: Escribir los tests que fallan**

Crear `frontend/src/lib/dashboardQueries.test.ts`:

```ts
import { useQuery, useQueryCache } from "@pinia/colada";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";

vi.mock("../services/dashboard", () => ({ getDashboard: vi.fn(), getWidgetData: vi.fn() }));

import { getDashboard, getWidgetData } from "../services/dashboard";
import { useAuthStore } from "../stores/auth";
import { currentUserId, panelQuery, prefetchPanel, prefetchWidget, widgetQuery } from "./dashboardQueries";

const getDashboardMock = vi.mocked(getDashboard);
const getWidgetDataMock = vi.mocked(getWidgetData);

let pinia: Pinia;

function signIn(id: string): void {
  useAuthStore().$patch({ token: "token", user: { id } as never });
}

describe("dashboard queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    // Installed in an app, as main.ts does: Colada's cache is a Pinia store
    // that reads its defaults from the app.
    createApp({ render: () => null }).use(pinia);
    setActivePinia(pinia);
    getDashboardMock.mockResolvedValue({ widgets: [], players: [] });
  });

  it("keys every entry by the signed-in user, so the next person on a shared computer starts afresh", () => {
    expect(panelQuery("u-1").key).toEqual(["dashboard", "u-1"]);
    expect(widgetQuery("u-1", "PLAYER_SUMMARY", "p1").key).toEqual(["dashboard", "u-1", "widget", "PLAYER_SUMMARY", "p1"]);
    expect(widgetQuery("u-1", "TOP_PLAYERS", null).key).toEqual(["dashboard", "u-1", "widget", "TOP_PLAYERS", ""]);
    expect(panelQuery("u-2").key).not.toEqual(panelQuery("u-1").key);
  });

  it("keeps an answer 15 s for whoever started it, and doesn't refetch when the tab regains focus", () => {
    for (const options of [panelQuery("u-1"), widgetQuery("u-1", "TOP_PLAYERS", null)]) {
      expect(options.staleTime).toBe(15_000);
      expect(options.refetchOnWindowFocus).toBe(false);
    }
  });

  it("lets the page take the request its route started, instead of a second one", async () => {
    signIn("u-1");
    prefetchPanel();
    const Page = defineComponent({
      setup() {
        const { data } = useQuery(() => panelQuery(currentUserId()));
        return () => h("p", data.value ? "listo" : "cargando");
      },
    });

    const wrapper = mount(Page, { global: { plugins: [pinia] } });
    await flushPromises();

    expect(getDashboardMock).toHaveBeenCalledOnce();
    expect(wrapper.text()).toBe("listo");
  });

  it("asks the server again on every visit, but only once for two visits at the same time", async () => {
    signIn("u-1");

    prefetchPanel();
    prefetchPanel();
    await flushPromises();
    expect(getDashboardMock).toHaveBeenCalledOnce();

    prefetchPanel();
    await flushPromises();
    expect(getDashboardMock).toHaveBeenCalledTimes(2);
  });

  it("never serves one user's panel to the next one", async () => {
    signIn("u-1");
    prefetchPanel();
    await flushPromises();

    signIn("u-2");
    prefetchPanel();
    await flushPromises();

    expect(getDashboardMock).toHaveBeenCalledTimes(2);
  });

  it("sends a widget's request in the same tick, and keeps a failure in the cache for the widget to show", async () => {
    signIn("u-1");
    getWidgetDataMock.mockRejectedValue(new Error("down"));

    prefetchWidget("TOP_PLAYERS", null);
    expect(getWidgetDataMock).toHaveBeenCalledExactlyOnceWith("TOP_PLAYERS", undefined);

    await flushPromises();
    const entry = useQueryCache().get(widgetQuery("u-1", "TOP_PLAYERS", null).key);
    expect(entry?.state.value.status).toBe("error");
  });
});
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/dashboardQueries.test.ts`
Expected: FAIL con `Failed to resolve import "./dashboardQueries"`.

- [ ] **Step 4: Implementar el módulo**

Crear `frontend/src/lib/dashboardQueries.ts`:

```ts
import { useQueryCache, type DefineQueryOptions } from "@pinia/colada";

import { getDashboard, getWidgetData, type Dashboard, type WidgetKey } from "../services/dashboard";
import { useAuthStore } from "../stores/auth";

// The dashboard's server data, cached with Pinia Colada. Every entry is keyed
// by the signed-in user, so on a shared lab computer the next person never
// gets the previous one's cached panel. The options are set on each query,
// not through the PiniaColada plugin, which keeps Colada out of the startup
// bundle; they keep the dashboard behaving as before: an answer serves for
// 15 s whoever started it (the route, a widget nearing the viewport), and
// returning to the tab doesn't refetch.
const FRESHNESS = { staleTime: 15_000, refetchOnWindowFocus: false } as const;

/** The dashboard's widget list and selectable players. */
export function panelQuery(userId: string): DefineQueryOptions<Dashboard> {
  return { key: ["dashboard", userId], query: () => getDashboard(), ...FRESHNESS };
}

/** One widget's data; `playerId` for a widget about one player. */
export function widgetQuery<T>(userId: string, key: WidgetKey, playerId: string | null): DefineQueryOptions<T> {
  return {
    key: ["dashboard", userId, "widget", key, playerId ?? ""],
    query: () => getWidgetData<T>(key, playerId ?? undefined),
    ...FRESHNESS,
  };
}

/** The signed-in user's id, which every dashboard entry is keyed by. */
export function currentUserId(): string {
  return useAuthStore().user?.id ?? "";
}

/**
 * Asks the server for `options` right away (every visit gets fresh data, as
 * it always did), unless a request for that entry is already in flight,
 * which is reused. A failure stays in the entry, for the page to show.
 */
function prefetch<T>(options: DefineQueryOptions<T>): void {
  const cache = useQueryCache();
  const entry = cache.ensure(options);
  (entry.pending?.refreshCall ?? cache.fetch(entry)).catch(() => undefined);
}

/** The panel's data, started by its route while the page's code downloads. */
export function prefetchPanel(): void {
  prefetch(panelQuery(currentUserId()));
}

/** A widget's data, started as it nears the viewport, alongside its code. */
export function prefetchWidget(key: WidgetKey, playerId: string | null): void {
  prefetch(widgetQuery(currentUserId(), key, playerId));
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/dashboardQueries.test.ts`
Expected: PASS (6 tests). Si `ensure` no acepta `DefineQueryOptions<T>` por tipos, `npx vue-tsc -b` lo dirá en el Step 6; `DefineQueryOptions` tiene valores planos y es asignable a `UseQueryOptions`.

- [ ] **Step 6: Lint, tipos y formato**

Run: `npx prettier --write src/lib/dashboardQueries.ts src/lib/dashboardQueries.test.ts && npm run lint && npx vue-tsc -b`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/dashboardQueries.ts frontend/src/lib/dashboardQueries.test.ts
git commit -F - <<'EOF'
Dashboard queries on Pinia Colada

The panel's list and each widget's data become Colada queries keyed by
the signed-in user, so the next person on a shared computer never gets
the previous one's cached panel. Prefetching asks the server on every
visit, as the route prefetch did, and reuses a request in flight.
Options live on each query, not in the global plugin, so Colada stays
out of the startup bundle.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Los widgets leen de la caché de Colada

**Files:**
- Modify: `frontend/src/lib/useWidgetData.ts` (reescritura completa)
- Modify: `frontend/src/views/dashboard/PanelView.vue` (solo el prefetch de widgets)
- Modify: `frontend/src/components/dashboard/widgets/widgets.test.ts` (montaje + una aserción)
- Modify: `frontend/src/views/dashboard/PanelView.test.ts` (montaje)

**Interfaces:**
- Consumes (Task 1): `widgetQuery<T>`, `currentUserId()`, `prefetchWidget(key, playerId)`.
- Produces: `useWidgetData<T>(key: WidgetKey, subject?: () => string | null): WidgetData<T>` y `usePlayerWidgetData<T>(key: WidgetKey)`, con la **misma firma de hoy**. `WidgetData<T> = { data: Ref<T | null>; loading: Ref<boolean>; error: Ref<string | null>; reload: () => Promise<void> }`. Se retira `prefetchWidgetData`.

Es un refactor que conserva el comportamiento. La red de seguridad son los tests actuales de widgets y de `PanelView`, que deben pasar sin cambiar lo que verifican.

- [ ] **Step 1: Instalar Pinia en el montaje de los tests de widgets**

En `frontend/src/components/dashboard/widgets/widgets.test.ts`:

Cambiar el import de Pinia:

```ts
import { createPinia, setActivePinia, type Pinia } from "pinia";
```

Agregar, después de `const PLAYERS = [...]`:

```ts
let pinia: Pinia;
```

En `mountWidget`, cambiar el montaje:

```ts
  const wrapper = mount(Host, { global: { plugins: [router, i18n, pinia] } });
```

Y el `beforeEach` del `describe("dashboard widgets")`:

```ts
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });
```

En el test `"player widgets don't request anything until a player is picked"`, agregar al final:

```ts
    expect(wrapper.find("[data-test='widget-loading']").exists()).toBe(false);
```

- [ ] **Step 2: Instalar Pinia en el montaje de los tests de `PanelView`**

En `frontend/src/views/dashboard/PanelView.test.ts`:

```ts
import { createPinia, setActivePinia, type Pinia } from "pinia";
```

Agregar antes de `function signIn`:

```ts
let pinia: Pinia;
```

En `mountView`:

```ts
  const wrapper = mount(PanelView, { global: { plugins: [router, i18n, pinia] } });
```

En el `beforeEach` del `describe("PanelView")`, reemplazar `setActivePinia(createPinia());` por:

```ts
    pinia = createPinia();
    setActivePinia(pinia);
```

- [ ] **Step 3: Verificar que los tests siguen en verde con el código actual**

Run: `npx vitest run src/components/dashboard/widgets/widgets.test.ts src/views/dashboard/PanelView.test.ts`
Expected: PASS. Solo cambió el montaje, y la aserción nueva ya se cumple hoy.

- [ ] **Step 4: Reescribir `useWidgetData` sobre `useQuery`**

Reemplazar el contenido de `frontend/src/lib/useWidgetData.ts`:

```ts
import { useQuery } from "@pinia/colada";
import { computed, type Ref } from "vue";
import { useI18n } from "vue-i18n";

import type { WidgetKey } from "../services/dashboard";
import { currentUserId, widgetQuery } from "./dashboardQueries";
import { extractErrorMessage } from "./errors";
import { usePlayerSelection } from "./playerSelection";

export interface WidgetData<T> {
  data: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  reload: () => Promise<void>;
}

/**
 * A widget's data in the shape WidgetCard shows: loading, an error message,
 * or the data. Each subject is its own cache entry, so a slower answer for
 * the previous player lands in that player's entry and never shows for the
 * new one.
 *
 * @param subject - For a widget about one player: who it is. Until there's
 *   one, nothing is requested and the widget isn't loading.
 */
export function useWidgetData<T>(key: WidgetKey, subject?: () => string | null): WidgetData<T> {
  const { t } = useI18n();
  const playerId = (): string | null => subject?.() ?? null;
  const enabled = (): boolean => !subject || playerId() !== null;
  // Usually already on its way: PanelView prefetches a widget as it nears the viewport.
  const query = useQuery(() => ({ ...widgetQuery<T>(currentUserId(), key, playerId()), enabled: enabled() }));

  return {
    data: computed(() => query.data.value ?? null),
    // Nothing to show yet, with a request in flight or about to start (a
    // retry after an error shows the skeleton again).
    loading: computed(
      () => enabled() && query.data.value === undefined && (query.isPending.value || query.isLoading.value),
    ),
    error: computed(() =>
      query.status.value === "error" && !query.isLoading.value
        ? extractErrorMessage(query.error.value, t("panel.widgetError"))
        : null,
    ),
    reload: async () => {
      await query.refetch();
    },
  };
}

/** {@link useWidgetData} for a widget about the dashboard's selected player. */
export function usePlayerWidgetData<T>(key: WidgetKey): WidgetData<T> & { subjectName: Ref<string | null> } {
  const selection = usePlayerSelection();
  return { ...useWidgetData<T>(key, () => selection.selectedId.value), subjectName: selection.selectedName };
}
```

- [ ] **Step 5: Prefetch de widgets en `PanelView` con la caché de Colada**

En `frontend/src/views/dashboard/PanelView.vue`, reemplazar el import:

```ts
import { prefetchWidgetData } from "../../lib/useWidgetData";
```

por

```ts
import { prefetchWidget } from "../../lib/dashboardQueries";
```

Reemplazar la función local `prefetchWidget` por:

```ts
/** A widget coming into view: its data starts loading while its code downloads. */
function prefetchNearingWidget(widget: WidgetSummary): void {
  const playerId = widget.subject === "player" ? selection.selectedId.value : null;
  // A player widget with no player to show asks for nothing.
  if (widget.subject === "player" && !playerId) return;
  prefetchWidget(widget.key, playerId);
}
```

Y en el template:

```html
            <LazyMount @visible="prefetchNearingWidget(widget)">
```

- [ ] **Step 6: Correr los tests del panel y de widgets**

Run: `npx vitest run src/components/dashboard src/views/dashboard src/lib`
Expected: PASS, incluidos:
- `"requests a widget's data as it nears the viewport, alongside its code rather than after it"`: una sola petición, enviada en el mismo tick;
- `"reloads when the dashboard's subject changes, ignoring a slower earlier answer"`;
- `"shows an error with a retry that asks again"`.

Si falla el de "una sola petición", revisar que la clave del prefetch y la del widget coincidan: mismo `currentUserId()`, mismo `playerId` (`null` → `""`).

- [ ] **Step 7: Lint, tipos y formato**

Run: `npx prettier --write src/lib/useWidgetData.ts src/views/dashboard/PanelView.vue src/components/dashboard/widgets/widgets.test.ts src/views/dashboard/PanelView.test.ts && npm run lint && npx vue-tsc -b`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/useWidgetData.ts frontend/src/views/dashboard/PanelView.vue frontend/src/components/dashboard/widgets/widgets.test.ts frontend/src/views/dashboard/PanelView.test.ts
git commit -F - <<'EOF'
Dashboard widgets read from the Colada cache

useWidgetData keeps its API, so no widget changed, but it now reads a
Colada query: each player is its own cache entry, which is what keeps a
slower answer for the previous player off the screen (the hand-rolled
request counter is gone). A widget nearing the viewport prefetches into
that same entry, so it still costs a single request.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: La lista del panel y su ruta usan Colada; se retira lo viejo

**Files:**
- Modify: `frontend/src/views/dashboard/PanelView.vue` (script)
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/router/index.test.ts`
- Modify: `frontend/src/lib/routeData.ts`
- Modify: `frontend/src/lib/pageData.ts`

**Interfaces:**
- Consumes (Task 1): `panelQuery(userId)`, `currentUserId()`, `prefetchPanel()`, `prefetchWidget(key, playerId)`.
- Produces: `DATA_KEYS` queda solo con `room(tournamentId)` y `tournamentAdmin(tournamentId)`. `pageData` queda solo con `loadTournamentRoom` y `loadTournamentAdmin`.

- [ ] **Step 1: Escribir los tests del router que fallan**

En `frontend/src/router/index.test.ts`, reemplazar el mock y los imports del principio:

```ts
// Pages' first data requests, started by their routes (see lib/pageData.ts
// and lib/dashboardQueries.ts).
vi.mock("../lib/pageData", () => ({
  loadTournamentRoom: vi.fn(() => new Promise(() => {})),
  loadTournamentAdmin: vi.fn(() => new Promise(() => {})),
}));
vi.mock("../lib/dashboardQueries", () => ({ prefetchPanel: vi.fn() }));

import { prefetchPanel } from "../lib/dashboardQueries";
import { loadTournamentAdmin, loadTournamentRoom } from "../lib/pageData";
```

En `"starts each heavy page's data while its code is still downloading"`, cambiar:

```ts
    expect(loadDashboard).toHaveBeenCalledOnce();
```

por

```ts
    expect(prefetchPanel).toHaveBeenCalledOnce();
```

En `"asks for nothing when the guard sends the visitor to log in"`, cambiar:

```ts
    expect(loadDashboard).not.toHaveBeenCalled();
```

por

```ts
    expect(prefetchPanel).not.toHaveBeenCalled();
```

Agregar, en el mismo `describe` y después de ese test:

```ts
  it("still opens the page when its prefetch fails, leaving the loading to the page", async () => {
    signIn("ADMINISTRATOR");
    vi.mocked(prefetchPanel).mockImplementationOnce(() => {
      throw new Error("chunk gone");
    });

    await router.push("/panel");
    await vi.dynamicImportSettled();

    expect(router.currentRoute.value.path).toBe("/panel");
  });
```

- [ ] **Step 2: Correr los tests del router y verificar que fallan**

Run: `npx vitest run src/router/index.test.ts`
Expected: FAIL en `"starts each heavy page's data…"`, porque `prefetchPanel` no se llama: la ruta aún usa `pageData.loadDashboard`.

- [ ] **Step 3: El `beforeEnter` de `/panel` usa `prefetchPanel`**

En `frontend/src/router/index.ts`, después de `const pageData = () => import("../lib/pageData");` agregar:

```ts
const dashboardQueries = () => import("../lib/dashboardQueries");
```

Y reemplazar el `beforeEnter` de la ruta `/panel`:

```ts
      beforeEnter: () => {
        // A failed prefetch leaves it to the page, which loads (or shows the error) itself.
        dashboardQueries()
          .then((queries) => queries.prefetchPanel())
          .catch(() => undefined);
      },
```

- [ ] **Step 4: Correr los tests del router y verificar que pasan**

Run: `npx vitest run src/router/index.test.ts`
Expected: PASS, incluido el test nuevo del fallo.

- [ ] **Step 5: `PanelView` carga la lista con `useQuery`**

En `frontend/src/views/dashboard/PanelView.vue`, reemplazar el bloque `<script setup>` completo por:

```ts
<script setup lang="ts">
import { useQuery } from "@pinia/colada";
import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";

import PlayerPicker from "../../components/dashboard/PlayerPicker.vue";
import { isRenderableWidget, WIDGET_VIEWS } from "../../components/dashboard/widgetRegistry";
import WidgetSkeleton from "../../components/dashboard/WidgetSkeleton.vue";
import AppHeader from "../../components/layout/AppHeader.vue";
import LazyMount from "../../components/ui/LazyMount.vue";
import LoadError from "../../components/ui/LoadError.vue";
import { currentUserId, panelQuery, prefetchWidget } from "../../lib/dashboardQueries";
import { extractErrorMessage } from "../../lib/errors";
import { providePlayerSelection } from "../../lib/playerSelection";
import type { WidgetSummary } from "../../services/dashboard";
import { useAuthStore } from "../../stores/auth";

// Every role's home: renders whichever widgets the administrator assigned
// to the user's role (the administrator gets all of them). The page only
// composes; each widget loads and renders its own data.
const auth = useAuthStore();
const { t } = useI18n();

// Usually already on its way: the route started it (lib/dashboardQueries.ts).
const panel = useQuery(() => panelQuery(currentUserId()));
const loading = computed(() => panel.status.value === "pending");
const loadError = computed(() =>
  panel.status.value === "error" ? extractErrorMessage(panel.error.value, t("panel.loadError")) : null,
);
const widgets = computed(() => (panel.data.value?.widgets ?? []).filter((widget) => isRenderableWidget(widget.key)));

const hasPlayerWidgets = computed(() => widgets.value.some((widget) => widget.subject === "player"));
const selection = providePlayerSelection({ hasPlayerWidgets: () => hasPlayerWidgets.value, urlParam: "jugador" });
// The selected player follows: the one in the URL, else the first.
watch(
  () => panel.data.value?.players,
  (players) => (selection.players.value = players ?? []),
  { immediate: true },
);

const role = computed(() => auth.user?.role ?? "");
const firstName = computed(() => auth.user?.name.split(/\s+/)[0] ?? "");
const noSubjects = computed(() => hasPlayerWidgets.value && selection.players.value.length === 0);

/** A widget coming into view: its data starts loading while its code downloads. */
function prefetchNearingWidget(widget: WidgetSummary): void {
  const playerId = widget.subject === "player" ? selection.selectedId.value : null;
  // A player widget with no player to show asks for nothing.
  if (widget.subject === "player" && !playerId) return;
  prefetchWidget(widget.key, playerId);
}
</script>
```

El template no cambia: sigue usando `loading`, `loadError`, `widgets`, `selection`, `noSubjects`, `role`, `firstName` y `prefetchNearingWidget`.

- [ ] **Step 6: Quitar las claves del panel de `routeData`**

En `frontend/src/lib/routeData.ts`, dejar `DATA_KEYS` así:

```ts
/** The key each prefetching page's data is kept under (shared by its route and the page). */
export const DATA_KEYS = {
  room: (tournamentId: string) => `room:${tournamentId}`,
  tournamentAdmin: (tournamentId: string) => `tournament-admin:${tournamentId}`,
};
```

- [ ] **Step 7: Quitar `loadDashboard` de `pageData`**

En `frontend/src/lib/pageData.ts`, borrar la línea `import { getDashboard } from "../services/dashboard";` y la función `loadDashboard` con su comentario JSDoc (`/** The dashboard's widget list and selectable players (PanelView). */`). Si el comentario de cabecera del archivo nombra el panel entre las páginas que usan este módulo, quitar el panel de esa lista.

Run: `grep -rn "loadDashboard\|DATA_KEYS.panel\|DATA_KEYS.widget\|prefetchWidgetData" src`
Expected: sin resultados.

- [ ] **Step 8: Correr la suite completa**

Run: `npm test`
Expected: PASS en todos los archivos. En particular `PanelView.test.ts` (lista de widgets, selector, jugador en la URL, estado vacío, editor de layouts, widget que falla) y `router/index.test.ts`.

- [ ] **Step 9: Lint, tipos y formato**

Run: `npx prettier --write src/views/dashboard/PanelView.vue src/router/index.ts src/router/index.test.ts src/lib/routeData.ts src/lib/pageData.ts && npm run lint && npx vue-tsc -b`
Expected: sin errores.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/views/dashboard/PanelView.vue frontend/src/router/index.ts frontend/src/router/index.test.ts frontend/src/lib/routeData.ts frontend/src/lib/pageData.ts
git commit -F - <<'EOF'
The panel page and its route use the Colada cache

The route prefetches the panel into the query the page reads, so data and
code still arrive in parallel, and every visit still asks the server
(a result recorded a moment ago shows up on coming back). A failed
prefetch leaves the loading to the page. routeData and pageData
drop what only the panel used.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Documentación y verificación completa

**Files:**
- Modify: `docs/arquitectura.md` (línea que empieza con `- **Datos en paralelo con el código.**`)
- Modify: `frontend/README.md` (la misma viñeta, y la de `- **Una página nueva**`)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada nuevo; cierra el tramo.

- [ ] **Step 1: Actualizar `docs/arquitectura.md`**

Reemplazar la viñeta `- **Datos en paralelo con el código.** …` por:

```markdown
- **Datos en paralelo con el código.** Las páginas pesadas (panel, sala del torneo, gestión del torneo) inician sus peticiones en el `beforeEnter` de su ruta, antes de que se descargue su código, y la página toma la petición en vuelo al montarse. El panel lo hace con la caché de Pinia Colada (`lib/dashboardQueries.ts`), con una entrada por usuario para que en un computador compartido nadie vea el panel del anterior; la sala y la gestión, con `lib/routeData.ts` y `lib/pageData.ts`, hasta su migración. Los widgets del panel cargan código y datos juntos al acercarse a la pantalla, y el código de una página se precarga cuando el usuario pasa por su enlace.
```

- [ ] **Step 2: Actualizar `frontend/README.md`**

Reemplazar la viñeta `- **Datos en paralelo con el código.** …` por:

```markdown
- **Datos en paralelo con el código.** Las páginas pesadas (panel, sala del torneo, gestión del torneo) piden sus datos en el `beforeEnter` de su ruta, mientras se descarga su código, y la página toma esa petición al montarse. El panel usa la caché de [Pinia Colada](https://pinia-colada.esm.dev/) ([`lib/dashboardQueries.ts`](src/lib/dashboardQueries.ts)); la sala y la gestión, [`lib/routeData.ts`](src/lib/routeData.ts) y [`lib/pageData.ts`](src/lib/pageData.ts), hasta su migración.
```

En la viñeta `- **Una página nueva**`, reemplazar la frase final `Si su carga es pesada, se agrega su función a \`lib/pageData.ts\` y se inicia en \`beforeEnter\` con \`prefetchData\`.` por:

```markdown
Si su carga es pesada, se define su query (como en [`lib/dashboardQueries.ts`](src/lib/dashboardQueries.ts), con el usuario en la clave si sus datos dependen de quién la ve) y se precarga en `beforeEnter`.
```

Run: `grep -n "Pinia\b\|pinia" README.md frontend/README.md`
Si alguna tabla o lista de tecnologías nombra Pinia, agregar "Pinia Colada (caché de datos del servidor)" junto a Pinia.

- [ ] **Step 3: Verificación completa del frontend**

Run: `npm run lint && npm test && npm run build`
Expected: lint sin errores; todos los tests en verde; build correcto.

- [ ] **Step 4: Verificar que el bundle inicial no creció y que Colada no está en él**

Run: `ls -la dist/assets | grep -E "index-.*\.js$" && grep -l "_pc_query" dist/assets/*.js`
Expected:
- `index-*.js` mide 83.0 kB (±0.1 kB);
- `_pc_query` (el id del store de caché de Colada) aparece **solo** en chunks que no son `index-*.js`.

Si aparece en `index-*.js`, algo importa `@pinia/colada` o `dashboardQueries` de forma estática desde el arranque: revisar `router/index.ts` y `main.ts`.

- [ ] **Step 5: Prueba de punta a punta contra la API real**

Levantar el backend (`cd backend && npx tsx src/server.ts`, en segundo plano, puerto 4000, contra el PostgreSQL local) y el frontend (`cd frontend && npx vite --port 5199 --strictPort`, en segundo plano). Las cuentas del seed están en la tabla "Datos de prueba" del `README.md` raíz, todas con contraseña `Test1234`.

Con Playwright:
1. Iniciar sesión como `admin@test.com` en `http://localhost:5199/login` y abrir `/panel`. Esperado: saludo con el nombre del administrador; los widgets muestran datos (ninguno con "No se pudo cargar este control") tras hacer scroll hasta el final; `browser_console_messages` con nivel `error` vacío.
2. Iniciar sesión como `coach@test.com` y abrir `/panel`. Cambiar de jugador con el selector. Esperado: la URL gana `?jugador=<id>` y los widgets de jugador muestran el nombre del jugador elegido.
3. Cerrar sesión, iniciar con `admin@test.com` otra vez y abrir `/panel`. Esperado: saludo y widgets del administrador, nunca los del entrenador.
4. Sin salir de la cuenta de administrador, ir a otra página (por ejemplo `/cuenta`) y volver a `/panel` antes de 15 s. Esperado: `browser_network_requests` muestra una **nueva** petición `GET /api/dashboard` para esa visita (cada visita pide datos nuevos) y la página no muestra el esqueleto de carga, porque presenta los datos anteriores mientras llegan los nuevos. No se modifican datos del seed.

Detener ambos servidores con `netstat -ano | grep ":4000 \|:5199 "` + `taskkill //F //PID <pid> //T`.

- [ ] **Step 6: Commit**

```bash
git add docs/arquitectura.md frontend/README.md README.md
git commit -F - <<'EOF'
Docs: the panel's data now comes through Pinia Colada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
