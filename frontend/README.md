# Frontend — Torre Central Hub

Aplicación web de Torre Central Hub: una SPA en Vue 3 + TypeScript con Vite, Pinia, Pinia Colada, vue-router, vue-i18n (español e inglés), Tailwind CSS 4 y reka-ui para los componentes accesibles (menús, pestañas, diálogos).

La visión general del sistema está en el [README raíz](../README.md), y las decisiones de arquitectura en [`docs/arquitectura.md`](../docs/arquitectura.md).

## Puesta en marcha

Requisitos: Node.js 22.12 o superior, y el [backend](../backend/README.md) corriendo para usar la app.

```bash
npm install
cp .env.example .env
npm run dev                 # http://localhost:5173
```

Para entrar con cada rol están las cuentas de prueba del [README raíz](../README.md#datos-de-prueba).

## Variables de entorno

| Variable          | Por defecto             | Uso                                                                                   |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| `VITE_SOCKET_URL` | `http://localhost:4000` | Servidor de Socket.IO. En producción sale de `.env.production` (el backend en Render) |
| `DEV_API_TARGET`  | `http://localhost:4000` | Solo `npm run dev`: a qué backend redirige el servidor de desarrollo `/api`           |

La app llama siempre a la API en `/api` de su propio origen, y no se configura: la sesión es una cookie `HttpOnly` que el navegador solo envía a ese sitio. En desarrollo el servidor de Vite redirige `/api` al backend; en producción lo hace Vercel (ver _Despliegue_).

Vite fija `VITE_SOCKET_URL` al compilar. Para producción la toma de [`.env.production`](.env.production), que está en el repositorio (solo tiene la dirección pública del backend, como `vercel.json`). Una variable del entorno del build, por ejemplo una definida en Vercel, le gana a ese archivo: no hace falta definirla, y si se define tiene que ser esa misma dirección.

## Scripts

| Script                            | Qué hace                                                     |
| --------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                     | Servidor de desarrollo con recarga en caliente               |
| `npm run build`                   | Chequea tipos (`vue-tsc`) y compila a `dist/`                |
| `npm run preview`                 | Sirve `dist/` para revisar la compilación                    |
| `npm test`                        | Pruebas con Vitest y jsdom (`test:watch` en modo observador) |
| `npm run test:coverage`           | Pruebas con informe de cobertura en `coverage/`              |
| `npm run lint`                    | ESLint sobre `src/`                                          |
| `npm run format` / `format:check` | Prettier                                                     |

## Estructura

```
src/
├── main.ts                 # Arranque: Pinia, router, i18n, sesión expirada, despliegues viejos
├── App.vue                 # Enlace para saltar al contenido, vista actual y diálogo de confirmación
├── router/                 # Rutas, carga diferida y guardas de sesión y rol
├── views/                  # Una pantalla por ruta, agrupadas por rol (admin/, organizer/, coach/…)
├── components/
│   ├── ui/                 # Genéricos: tabla, fecha, diálogo, error de carga, tema, idioma
│   ├── layout/             # Encabezado, menú de usuario, marco de las pantallas de acceso
│   ├── dashboard/          # Tarjetas del panel y registro de widgets (widgets/)
│   ├── charts/             # Gráficos del panel y de la sala
│   ├── tournament/         # Sala del torneo: emparejamientos, resultados, clasificación
│   ├── tournament-admin/   # Gestión: configuración, inscripciones, rondas
│   ├── account/            # Perfil: afiliaciones y derechos sobre datos
│   └── home/               # Portada y sus ilustraciones
├── queries/                # Datos del servidor en caché (Pinia Colada): claves, lecturas y cómo cambia cada una
├── stores/                 # Estado del cliente (Pinia): sesión, tema, idioma, diálogo de confirmación
├── services/               # Un módulo por recurso de la API (axios) y el cliente Socket.IO
├── lib/                    # Composables y utilidades sin estado global
├── i18n/                   # Configuración y textos (locales/es.json, locales/en.json)
└── test-support/           # Ayudas compartidas por las pruebas
```

Las vistas no llaman a axios directamente: pasan por `services/`, que es la única capa que conoce URLs y formatos de la API.

Lo que viene del servidor vive en la caché de [Pinia Colada](https://pinia-colada.esm.dev/), no en los stores. Cada lectura tiene su definición en [`queries/`](src/queries/) (clave y petición), y cada página la usa con `useQuery` y muestra carga, error y reintento igual que las demás con [`useQueryStatus`](src/queries/status.ts). Todo lo de un torneo cuelga de `["tournament", id]`, así que una respuesta tardía del torneo A nunca aparece en la página del B, y un cambio (o un evento en vivo) invalida esa clave y se vuelve a leer lo que muestra la pantalla. Después de escribir, la página guarda en la caché lo que respondió el servidor (`showTournament`, `addToRoster`…) o invalida lo que el cambio afecta. Un formulario abierto no se pisa cuando la caché se vuelve a leer en segundo plano (al volver a la pestaña, por ejemplo): solo sigue al servidor mientras no tenga cambios sin guardar. Los stores quedan para el estado del cliente; el usuario de la sesión es parte de él, porque lo leen el encabezado y las guardas de ruta.

## Rutas

| Ruta                                               | Pantalla                                          | Acceso                     |
| -------------------------------------------------- | ------------------------------------------------- | -------------------------- |
| `/`                                                | Portada                                           | Público                    |
| `/login`, `/registro`                              | Ingreso y registro                                | Público                    |
| `/olvide-password`, `/restablecer-password?token=` | Recuperar contraseña                              | Público                    |
| `/panel`                                           | Panel de inicio con los widgets del rol           | Sesión                     |
| `/panel/configuracion`                             | Widgets de cada rol                               | Administrador              |
| `/cuenta`                                          | Perfil y privacidad                               | Sesión                     |
| `/en-juego`                                        | Torneos en curso y finalizados                    | Sesión                     |
| `/torneos/:id/sala`                                | Sala en vivo: rondas, clasificación, estadísticas | Sesión                     |
| `/torneos`                                         | Torneos que administra                            | Organizador, administrador |
| `/torneos/nuevo`                                   | Crear torneo                                      | Organizador, administrador |
| `/torneos/:id`                                     | Gestión del torneo                                | Organizador, administrador |
| `/clubes`                                          | Clubes                                            | Organizador, administrador |
| `/mis-torneos`                                     | Inscripciones del jugador                         | Jugador                    |
| `/mis-jugadores`                                   | Jugadores vinculados                              | Entrenador                 |
| `/usuarios`                                        | Usuarios, roles y estado                          | Administrador              |
| `/auditoria`                                       | Bitácora de auditoría                             | Administrador              |

Sin sesión, una ruta protegida lleva a `/login?redirect=<ruta>`; con un rol que no corresponde, a la portada. El backend vuelve a validar todo: la guarda del router solo evita mostrar pantallas que la API rechazaría.

## Cómo carga la app

El paquete inicial lleva solo lo que necesitan la portada y el login. El resto llega cuando hace falta:

- **Páginas con carga diferida.** Cada vista es su propio archivo, y el código de una página empieza a descargarse cuando el usuario pasa el puntero, el foco o el dedo por su enlace en el encabezado ([`lib/prefetchRoute.ts`](src/lib/prefetchRoute.ts)).
- **Datos en paralelo con el código.** Las páginas pesadas (panel, sala del torneo, gestión del torneo) piden sus datos en el `beforeEnter` de su ruta, mientras se descarga su código ([`queries/prefetch.ts`](src/queries/prefetch.ts)), y la página encuentra la petición en vuelo en la caché.
- **Bajo demanda.** Los widgets del panel cargan código y datos al acercarse a la pantalla (`LazyMount`); el cliente de Socket.IO, solo en las vistas en vivo; el selector de fechas, el menú de usuario, el diálogo de confirmación y el inglés, cuando se necesitan.
- **Despliegues nuevos.** Los archivos compilados llevan un hash en el nombre y se cachean para siempre (ver `vercel.json`). Una pestaña abierta antes de un despliegue que ya no encuentra un archivo pasa a navegar con recargas completas, que traen la versión nueva ([`lib/staleChunks.ts`](src/lib/staleChunks.ts)).

Al agregar una dependencia pesada, conviene importarla de forma dinámica en la vista que la usa, para no sumarla al arranque de todas las páginas.

## Convenciones

- **Textos.** Todo texto visible sale de `i18n/locales/es.json` y `en.json` con `t("…")`, y cada clave debe existir en los dos (`i18n/locales.test.ts` lo exige). El español es el idioma por defecto.
- **Tema e idioma.** Se guardan en `localStorage` (`torre.theme`, `torre.locale`). El tema se aplica en `index.html` antes del primer render, para que no parpadee.
- **Estilos.** Tailwind con los tokens de color de [`style.css`](src/style.css) (`bg-bg`, `text-text-muted`, `bg-surface`, `text-accent`…), que cambian solos con el tema.
- **Estado en la URL.** La pestaña, la ronda, el jugador o el club seleccionados viven en la URL con `useQueryParam`, así que sobreviven a una recarga y un enlace copiado abre la página igual.
- **Cargas y errores.** Toda carga que falla muestra `LoadError` con un botón para reintentar, y lo que llega o cambia se anuncia a los lectores de pantalla.
- **Acciones con consecuencias.** Se confirman con `useConfirm()` (un diálogo accesible, no `window.confirm`). Los formularios con cambios sin guardar avisan antes de salir (`useUnsavedChangesGuard`).
- **Formularios.** Cada error queda asociado a su campo, y al enviar con errores el foco va al primero.
- **Sesión.** Es una cookie `HttpOnly` que pone la API al iniciar sesión: ningún script la puede leer, y la app no guarda token alguno. El store de sesión solo recuerda quién entró, para el encabezado y las guardas de ruta. El socket en vivo se identifica con un ticket de un minuto que pide antes de cada conexión ([`services/socket.ts`](src/services/socket.ts)).
- **Sesión vencida.** Si la API responde 401 con una sesión abierta, se limpia la sesión y se vuelve al login con la ruta de regreso ([`lib/sessionExpiry.ts`](src/lib/sessionExpiry.ts)).

## Contrato con la API

Los catálogos de la API (roles, estados, desempates, resultados, widgets, eventos de tiempo real…), sus códigos de error y el tipo de cada respuesta no se copian aquí: vienen de [`backend/src/contracts/`](../backend/src/contracts/), que este proyecto importa como `@contracts` (alias en `vite.config.ts`, `vitest.config.ts` y `tsconfig.app.json`). Los servicios exponen cada tipo en su forma JSON con [`Serialized<T>`](src/lib/serialized.ts), en la que las fechas llegan como texto:

```ts
import type { TournamentDto } from "@contracts";
export type Tournament = Serialized<TournamentDto>;
```

Si el backend renombra o quita un campo, o agrega un valor a un catálogo que una vista no maneja, el frontend deja de compilar. Los tipos de lo que el frontend _envía_ siguen declarados en sus servicios.

## Pruebas

```bash
npm test
npm run test:coverage
npm run test:e2e        # navegador (Playwright); necesita PostgreSQL y el .env del backend
```

Las pruebas corren en jsdom y viven junto a lo que prueban (`X.vue` → `X.test.ts`). Además de componentes, vistas, stores y utilidades, hay pruebas que cuidan los límites del proyecto:

- [`contracts.test.ts`](src/contracts.test.ts) comprueba que cada valor de los catálogos de la API que la interfaz muestra (roles, estados, desempates, widgets, acciones de auditoría, códigos de error…) tenga texto en los dos idiomas. Que frontend y backend coincidan ya lo comprueba el compilador: ver _Contrato con la API_.
- [`services/http.test.ts`](src/services/http.test.ts) fija la URL, el método y el cuerpo exactos de cada llamada a la API.
- [`deployment.test.ts`](src/deployment.test.ts) comprueba las reglas de caché y de reescritura de `vercel.json`, y sus cabeceras de seguridad (la CSP se aplica, no solo se reporta).
- [`views/overHttp.test.ts`](src/views/overHttp.test.ts) lleva algunas páginas por el cliente HTTP real contra una API simulada con [MSW](https://mswjs.io/) ([`test-support/fakeApi.ts`](src/test-support/fakeApi.ts)): que la API se llame en `/api` del propio sitio sin ningún token a la vista, la sesión que vence, los errores tal como llegan del servidor.

La suite de navegador ([`e2e/`](e2e/), [Playwright](https://playwright.dev/)) recorre los flujos entre roles: cada rol inicia sesión; un organizador crea un torneo, inscribe jugadores y publica la ronda 1; un árbitro registra un resultado desde otro navegador y la sala del organizador lo muestra en vivo; se exporta la clasificación en PDF; un entrenador sigue a un jugador solo cuando este acepta; y la sesión es una cookie que los scripts de la página no ven, que al cerrar sesión deja de servir aunque alguien la haya copiado. Corre contra el build de producción servido por `vite preview`, que envía las mismas cabeceras que `vercel.json`, y falla si cualquier página viola la CSP. La API es la real, sobre una base propia (`<base>_e2e_test`) que el backend migra, vacía y siembra antes de cada corrida (`npm run e2e:prepare`), y queda detrás del mismo origen (`/api`), como la sirve Vercel. Playwright levanta los dos servidores solo.

Las pruebas se chequean con `tsconfig.vitest.json`, que incluye los tipos de Node; el código de la app no los tiene, así que no puede usar APIs de Node por accidente.

## Despliegue

`npm run build` deja la app en `dist/`. [`vercel.json`](vercel.json) está pensado para Vercel:

- Cualquier ruta que no sea `/assets/…` sirve `index.html`, para que el router resuelva la página.
- `/assets/…` se cachea un año como inmutable; `index.html` no, así que un despliegue nuevo se ve en la siguiente visita.
- `/api/…` se reescribe hacia el backend en Render, así la API queda en el mismo sitio que la app y la cookie de sesión es propia, no de terceros.
- Cada página lleva cabeceras de seguridad: HSTS, `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy` y una Content-Security-Policy que se aplica. Solo admite scripts propios y el de tema de `index.html`, por su hash: si se edita ese script, `deployment.test.ts` falla hasta que se actualice el hash. `connect-src` admite el propio origen y el backend en Render (el socket va directo allí). `npm run preview` sirve las mismas cabeceras.

La configuración de Vercel y Render, qué variables lleva cada uno y cómo verificar un despliegue están en [`docs/despliegue.md`](../docs/despliegue.md). En otro servidor estático hay que replicar esas reglas, incluida la redirección de `/api`. Si cambia la dirección del backend, se cambia en `vercel.json` y en `.env.production`: `deployment.test.ts` falla si no coinciden.

El build lee el contrato de `../backend/src/contracts/`, así que necesita el repositorio completo, no solo la carpeta `frontend`. En Vercel, con _Root Directory_ en `frontend`, eso es la opción _Include files outside the root directory in the Build Step_ (activada por defecto).

## Cómo extender

- **Una página nueva**: la vista en `views/`, y su ruta en [`router/index.ts`](src/router/index.ts) con `component: () => import(…)` y, si es privada, `meta: { requiresAuth: true, roles: […] }`. Sus datos se definen en [`queries/`](src/queries/) y se leen con `useQuery` y `useQueryStatus`; si su carga es pesada, se precargan en `beforeEnter` (como `prefetchTournamentRoom`).
- **Un recurso nuevo de la API**: un módulo en `services/`, y su caso en `services/http.test.ts`.
- **Un widget del panel**: su componente en `components/dashboard/widgets/` y su entrada en [`components/dashboard/widgetRegistry.ts`](src/components/dashboard/widgetRegistry.ts). El registro está tipado con las claves del catálogo, así que el build falla si falta alguno. Del lado del backend, ver su [README](../backend/README.md#cómo-extender).
