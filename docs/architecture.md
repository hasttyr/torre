# Arquitectura

Cómo está construido Torre Central Hub por dentro y cómo se prueba. El porqué de cada decisión está en [`decisions/`](decisions/); cómo correr y extender cada proyecto, en [`backend/README.md`](../backend/README.md) y [`frontend/README.md`](../frontend/README.md).

## Visión general

Cliente-servidor con dos canales:

- **REST** (`/api`) para toda operación que consulta o cambia datos.
- **Socket.IO** para avisar que algo cambió en un torneo, con una sala por torneo. Los eventos solo avisan: el cliente vuelve a pedir los datos por REST, con sus permisos ([decisión 003](decisions/003-los-eventos-solo-avisan.md)).

```
Vue 3 SPA ──REST──▶ Express ──▶ servicios de dominio ──▶ Prisma ──▶ PostgreSQL
    ▲                                   │
    └────────── Socket.IO ◀── emitToTournament (tras confirmar la transacción)
```

En producción el frontend está en Vercel y el backend con su base en Render. Vercel reescribe `/api` hacia Render para que la cookie de sesión sea del mismo sitio que la app; el socket va directo a Render con un ticket ([decisión 002](decisions/002-sesion-en-cookie-httponly.md), [despliegue](runbooks/despliegue.md)).

## Backend (`backend/src`)

| Capa          | Carpeta                                                                                | Responsabilidad                                                               | No hace                                |
| ------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------- |
| Rutas         | `routes/`                                                                              | Método, ruta y compuerta gruesa de rol (`requireAuth`, `requireRole`)         | Reglas de negocio                      |
| Middlewares   | `middlewares/`                                                                         | Sesión, límites de peticiones, traducción de errores a HTTP                   | —                                      |
| Controladores | `controllers/`                                                                         | Validar la entrada (`parseOrThrow` + zod), llamar al servicio, responder      | Consultar la base                      |
| Validadores   | `validators/`                                                                          | Forma y catálogos de cada petición                                            | Reglas que dependen de datos           |
| Servicios     | `services/`                                                                            | Casos de uso: permisos finos, estado, transacciones, auditoría, difusión      | Conocer HTTP (solo lanzan `HttpError`) |
| Dominio puro  | `services/pairing/`, `standings.calculator.ts`, `dashboard/playerStats.ts`, `exports/` | Emparejar, clasificar, agregar, armar documentos                              | Tocar la base                          |
| Contrato      | `contracts/`                                                                           | Catálogos, códigos de error y tipos de respuesta, compartidos con el frontend | Importar nada de fuera de la carpeta   |

Los servicios reciben el cliente de Prisma como parámetro: así se prueban con dobles y comparten un cliente transaccional cuando una operación debe ser atómica.

Lo que sostiene el diseño:

- **Reglas de acceso en un solo lugar.** `services/tournamentAccess.ts` responde qué puede hacer un usuario en un torneo y si el estado del torneo lo permite. `services/dashboard/scopes.ts` responde de qué jugadores puede ver datos.
- **Cambios a un torneo serializados.** Toda escritura empieza con `lockTournament`, y la auditoría se escribe en la misma transacción ([decisión 004](decisions/004-cambios-a-un-torneo-bajo-bloqueo.md)).
- **El dominio no conoce la base.** El motor suizo recibe candidatos y devuelve mesas; `pairing/pairingHistory.ts` traduce el historial guardado. El seed usa el mismo motor y la misma calculadora de clasificación que la app.
- **La clasificación se reconstruye completa** en cada cambio de resultado, dentro de la transacción, y guarda el puesto oficial (`standings.rank`). Nunca se parchea: una corrección no puede dejar números viejos.
- **La sesión se verifica en cada petición** contra la base: un bloqueo, una supresión de datos o un cambio de rol surten efecto en la siguiente petición.
- **La bitácora no guarda nombres**, guarda referencias a personas ([decisión 005](decisions/005-la-bitacora-no-guarda-nombres.md)).
- **Extensión sin tocar rutas.** Un widget del panel nuevo se agrega con su clave en el catálogo, su cargador y su componente.

## Frontend (`frontend/src`)

| Carpeta       | Responsabilidad                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `views/`      | Pantallas por ruta, agrupadas por rol. No llaman a axios                                                                                                         |
| `components/` | `ui/` genéricos, `layout/`, `charts/`, `dashboard/`, `tournament/` (sala), `tournament-admin/`, `account/`, `home/`                                              |
| `queries/`    | Datos del servidor en caché (Pinia Colada): clave, lectura y cómo la actualiza cada cambio ([decisión 009](decisions/009-datos-del-servidor-en-pinia-colada.md)) |
| `stores/`     | Estado del cliente (Pinia): sesión, tema, idioma, diálogo de confirmación                                                                                        |
| `services/`   | Un módulo por recurso de la API; la única capa que conoce URLs y formatos                                                                                        |
| `lib/`        | Composables y utilidades: formato y fechas, acceso por rol, tiempo real, sesión vencida, estado en la URL                                                        |
| `i18n/`       | Español (en el arranque) e inglés (se descarga al elegirlo)                                                                                                      |

Lo que sostiene el diseño:

- **Arranque mínimo.** Solo la portada y el login van en el paquete inicial; cada página, el cliente de Socket.IO, el selector de fechas y el inglés llegan cuando hacen falta.
- **Datos en paralelo con el código.** Las páginas pesadas (panel, sala, gestión del torneo) piden sus datos en el `beforeEnter` de su ruta mientras se descarga su código, y la página toma la petición en vuelo de la caché.
- **Despliegues sin pestañas rotas.** Los archivos compilados llevan hash y se cachean un año; `index.html` nunca. Una pestaña vieja que no encuentra un archivo pasa a recargas completas (`lib/staleChunks.ts`).
- **Sesión vencida.** Un 401 con sesión abierta limpia la sesión y vuelve al login con la ruta de regreso (`lib/sessionExpiry.ts`).
- **Tiempo real con coalescencia.** `lib/useTournamentLive.ts` entra a la sala, vuelve a entrar tras cada reconexión y agrupa ráfagas de eventos en un solo refresco.
- **Fechas de calendario.** Se guardan como medianoche UTC y se muestran en UTC (`lib/format.ts`); lo que el usuario escribe es un día de su calendario (`lib/dates.ts`). Ninguna fecha se corre un día en Colombia.
- **Accesibilidad.** Menús, pestañas y diálogos sobre reka-ui; errores atados a su campo; cargas y cambios anunciados en regiones vivas.

## Contrato entre frontend y backend

`backend/src/contracts/` define catálogos, códigos de error y el tipo de cada respuesta, y el frontend compila contra esos mismos archivos con el alias `@contracts` ([decisión 001](decisions/001-contrato-compartido.md)). Un campo renombrado o un valor de catálogo nuevo no compila del lado que no lo sigue. Lo que el compilador no ve lo cubren tres pruebas: `backend/src/contracts/contracts.test.ts` (enums de la base y esquemas de validación contra el contrato), `frontend/src/contracts.test.ts` (cada valor mostrado tiene texto en los dos idiomas) y `frontend/src/services/http.test.ts` (URL, método y cuerpo de cada llamada).

## Estrategia de pruebas

| Nivel                | Qué cubre                                                                                              | Dónde                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Dominio puro         | Emparejamiento, desempates, agregaciones, documentos                                                   | `services/pairing/*.test.ts`, `standings.calculator.test.ts` |
| Servicios            | Reglas, permisos, estados y atomicidad, con Prisma simulado                                            | `backend/src/services/**/*.test.ts`                          |
| HTTP                 | Códigos de estado, compuertas de rol, validación, cabeceras                                            | `backend/src/routes/*.test.ts`                               |
| Integración          | Lo que solo la base prueba: SQL, restricciones, transacciones, carreras, supresión de datos, Socket.IO | `backend/src/**/*.int.test.ts` (PostgreSQL real)             |
| Componentes y vistas | Interacción, estados vacíos y de error, accesibilidad básica                                           | `frontend/src/**/*.test.ts`                                  |
| Vistas por HTTP      | Páginas por el cliente HTTP real contra una API simulada (MSW)                                         | `frontend/src/views/overHttp.test.ts`                        |
| Navegador (E2E)      | Flujos entre roles con Playwright, sobre el build de producción y la API real                          | `frontend/e2e/*.spec.ts`                                     |
| Despliegue           | Caché, reescritura de `/api` y CSP de `vercel.json`                                                    | `frontend/src/deployment.test.ts`                            |

Los umbrales de cobertura de cada proyecto solo suben ([decisión 008](decisions/008-la-cobertura-solo-sube.md)). Cómo correr todo como el CI: [runbooks/validar-ci.md](runbooks/validar-ci.md).
