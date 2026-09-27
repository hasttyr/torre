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

| Variable          | Por defecto                 | Uso                   |
| ----------------- | --------------------------- | --------------------- |
| `VITE_API_URL`    | `http://localhost:4000/api` | Base de la API REST   |
| `VITE_SOCKET_URL` | `http://localhost:4000`     | Servidor de Socket.IO |

Vite las fija al compilar: en un despliegue se definen antes de `npm run build`, no en tiempo de ejecución.

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
├── stores/                 # Estado compartido (Pinia): sesión, torneos, rondas, tema, idioma
├── services/               # Un módulo por recurso de la API (axios) y el cliente Socket.IO
├── lib/                    # Composables y utilidades sin estado global
├── i18n/                   # Configuración y textos (locales/es.json, locales/en.json)
└── test-support/           # Ayudas compartidas por las pruebas
```

Las vistas no llaman a axios directamente: pasan por `services/`, que es la única capa que conoce URLs y formatos de la API.

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
- **Datos en paralelo con el código.** Las páginas pesadas (panel, sala del torneo, gestión del torneo) piden sus datos en el `beforeEnter` de su ruta, mientras se descarga su código, y la página toma esa petición al montarse. El panel usa la caché de [Pinia Colada](https://pinia-colada.esm.dev/) ([`lib/dashboardQueries.ts`](src/lib/dashboardQueries.ts)); la sala y la gestión, [`lib/routeData.ts`](src/lib/routeData.ts) y [`lib/pageData.ts`](src/lib/pageData.ts), hasta su migración.
- **Bajo demanda.** Los widgets del panel cargan código y datos al acercarse a la pantalla (`LazyMount`); el cliente de Socket.IO, solo en las vistas en vivo; el selector de fechas, el menú de usuario, el diálogo de confirmación y el inglés, cuando se necesitan.
- **Despliegues nuevos.** Los archivos compilados llevan un hash en el nombre y se cachean para siempre (ver `vercel.json`). Una pestaña abierta antes de un despliegue que ya no encuentra un archivo pasa a navegar con recargas completas, que traen la versión nueva ([`lib/staleChunks.ts`](src/lib/staleChunks.ts)).

Al agregar una dependencia pesada, conviene importarla de forma dinámica en la vista que la usa, para no sumarla al arranque de todas las páginas.

## Convenciones

- **Textos.** Todo texto visible sale de `i18n/locales/es.json` y `en.json` con `t("…")`, y cada clave debe existir en los dos (`i18n/locales.test.ts` lo exige). El español es el idioma por defecto.
- **Tema e idioma.** Se guardan en `localStorage` (`torre.theme`, `torre.locale`). El tema se aplica en `index.html` antes del primer render, para que no parpadee.
- **Estilos.** Tailwind con los tokens de color de [`style.css`](src/style.css) (`bg-bg`, `text-text-muted`, `bg-surface`, `text-accent`…), que cambian solos con el tema. La portada sigue el lenguaje visual de [`DESIGN.md`](DESIGN.md).
- **Estado en la URL.** La pestaña, la ronda, el jugador o el club seleccionados viven en la URL con `useQueryParam`, así que sobreviven a una recarga y un enlace copiado abre la página igual.
- **Cargas y errores.** Toda carga que falla muestra `LoadError` con un botón para reintentar, y lo que llega o cambia se anuncia a los lectores de pantalla.
- **Acciones con consecuencias.** Se confirman con `useConfirm()` (un diálogo accesible, no `window.confirm`). Los formularios con cambios sin guardar avisan antes de salir (`useUnsavedChangesGuard`).
- **Formularios.** Cada error queda asociado a su campo, y al enviar con errores el foco va al primero.
- **Sesión vencida.** Si la API responde 401 a una petición autenticada, se limpia la sesión y se vuelve al login con la ruta de regreso ([`lib/sessionExpiry.ts`](src/lib/sessionExpiry.ts)).

## Pruebas

```bash
npm test
npm run test:coverage
```

Las pruebas corren en jsdom y viven junto a lo que prueban (`X.vue` → `X.test.ts`). Además de componentes, vistas, stores y utilidades, hay pruebas que cuidan los límites del proyecto:

- [`contracts.test.ts`](src/contracts.test.ts) lee el código del backend y falla si se desalinea algún catálogo duplicado: widgets, roles, eventos de tiempo real, resultados, géneros, discapacidades y tipos de solicitud de datos.
- [`services/http.test.ts`](src/services/http.test.ts) fija la URL, el método y el cuerpo exactos de cada llamada a la API.
- [`deployment.test.ts`](src/deployment.test.ts) comprueba las reglas de caché y de reescritura de `vercel.json`.

Las pruebas se chequean con `tsconfig.vitest.json`, que incluye los tipos de Node; el código de la app no los tiene, así que no puede usar APIs de Node por accidente.

## Despliegue

`npm run build` deja la app en `dist/`. [`vercel.json`](vercel.json) está pensado para Vercel:

- Cualquier ruta que no sea `/assets/…` sirve `index.html`, para que el router resuelva la página.
- `/assets/…` se cachea un año como inmutable; `index.html` no, así que un despliegue nuevo se ve en la siguiente visita.

En otro servidor estático hay que replicar esas dos reglas, y definir `VITE_API_URL` y `VITE_SOCKET_URL` antes de compilar.

## Cómo extender

- **Una página nueva**: la vista en `views/`, y su ruta en [`router/index.ts`](src/router/index.ts) con `component: () => import(…)` y, si es privada, `meta: { requiresAuth: true, roles: […] }`. Si su carga es pesada, se define su query (como en [`lib/dashboardQueries.ts`](src/lib/dashboardQueries.ts), con el usuario en la clave si sus datos dependen de quién la ve) y se precarga en `beforeEnter`.
- **Un recurso nuevo de la API**: un módulo en `services/`, y su caso en `services/http.test.ts`.
- **Un widget del panel**: su componente en `components/dashboard/widgets/` y su entrada en [`components/dashboard/widgetRegistry.ts`](src/components/dashboard/widgetRegistry.ts). El registro está tipado con las claves del catálogo, así que el build falla si falta alguno. Del lado del backend, ver su [README](../backend/README.md#cómo-extender).
