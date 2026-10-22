# Frontend

SPA Vue 3. Cómo correrla, la tabla de rutas, la carga diferida y las convenciones completas: [`README.md`](README.md). Aquí, lo que conviene tener presente al cambiar código.

## Capas

`views/` (una pantalla por ruta, agrupadas por rol) → `queries/` (Pinia Colada: clave y lectura de cada dato del servidor) → `services/` (axios; la única capa que conoce URLs). Las vistas nunca llaman a axios directamente. `stores/` es solo estado del cliente: sesión, tema, idioma, diálogo de confirmación.

- Los tipos de lo que responde la API vienen de `@contracts` (`backend/src/contracts/`) como `Serialized<T>`: las fechas llegan como texto. Si el backend cambia un campo, el frontend deja de compilar, y está bien que sea así.
- Todo lo de un torneo cuelga de la clave `["tournament", id]`: después de un cambio, se invalida o se guarda en la caché lo que el servidor respondió.
- Estados y catálogos (`tournament.status === "FINISHED"`, roles…) se comparan con los valores del contrato, nunca con textos traducidos.

## Al agregar o cambiar algo

- **Una llamada a la API**: la función en `services/<recurso>.ts` y su fila en la tabla de `services/http.test.ts` (método, URL y cuerpo exactos).
- **Un texto visible**: la clave en `i18n/locales/es.json` y `en.json`. `i18n/locales.test.ts` falla si falta en uno; `contracts.test.ts`, si un valor de un catálogo no tiene texto.
- **Una página**: la ruta en `router/index.ts` con `component: () => import(…)` y `meta: { requiresAuth, roles }`. La guarda solo evita mostrar lo que la API rechazaría; el permiso real lo decide el backend.
- **Estilos**: los tokens de `style.css` (`bg-surface`, `text-text-muted`, `text-accent`…), que siguen el tema claro u oscuro. No colores sueltos.
- **Acciones con consecuencias**: `useConfirm()`, nunca `window.confirm`. Una carga que falla muestra `LoadError` con reintento.
- **Lo seleccionado** (pestaña, ronda, jugador) va en la URL con `useQueryParam`.

## Tests

- Viven junto al archivo (`X.vue` → `X.test.ts`) y montan con el `i18n` real, así que se comparan textos en español ("En vivo", "Ver resultados →").
- **Pinia Colada cachea dentro del mismo Pinia.** Montar la misma vista dos veces en un test devuelve los datos del primer montaje aunque cambie el mock. Un escenario por test (cada `beforeEach` crea un Pinia nuevo).
- El encabezado global también muestra textos (el enlace "En vivo" del menú): para mirar una parte de la página, acotar el selector (`main header p`).
- Las fechas se prueban en hora de Bogotá (los tests "in Colombia (UTC-5)"): una fecha de torneo es un día de calendario y no se puede correr al anterior.
- `npm run test:e2e` (Playwright) necesita PostgreSQL y el `.env` del backend: levanta la API real sobre una base propia.

## Despliegue

`vercel.json` (reescritura de `/api` hacia Render, caché, CSP) y `.env.production` (`VITE_SOCKET_URL`) tienen que coincidir: lo comprueba `deployment.test.ts`. Si se edita el script de tema de `index.html`, su hash en la CSP cambia y ese test falla hasta actualizarlo. Pasos completos en `docs/runbooks/despliegue.md`.
