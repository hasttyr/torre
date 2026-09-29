# Arquitectura — Torre Central Hub

Este documento describe cómo está construido el sistema por dentro, las decisiones que lo sostienen y el resultado de la revisión de arquitectura de septiembre de 2026: qué se encontró, qué se corrigió y qué queda recomendado. Complementa a [`diagrama-componentes.md`](./diagrama-componentes.md), que relaciona el diagrama de S4 con las carpetas del código.

## Visión general

Cliente-servidor con dos canales:

- **REST** (`/api`) para toda operación que cambia o consulta datos.
- **Socket.IO** para avisar en tiempo real que algo cambió en un torneo (salas por torneo). Los eventos solo notifican: el cliente vuelve a pedir los datos por REST, así que existe una sola fuente de verdad.

```
Vue 3 SPA ──REST──▶ Express ──▶ servicios de dominio ──▶ Prisma ──▶ PostgreSQL
    ▲                                   │
    └────────── Socket.IO ◀── emitToTournament (tras confirmar la transacción)
```

## Backend (`backend/src`)

### Capas

| Capa | Carpeta | Responsabilidad | No hace |
|---|---|---|---|
| Rutas | `routes/` | Método, ruta y compuerta gruesa de rol (`requireRole`) | Reglas de negocio |
| Middlewares | `middlewares/` | Autenticación, envoltura async, traducción de errores a HTTP | — |
| Controladores | `controllers/` | Validar la entrada (`parseOrThrow` + zod), llamar al servicio y responder | Consultas a la BD |
| Validadores | `validators/` | Esquemas zod: forma y catálogos de cada petición | Reglas que dependen de datos |
| Servicios | `services/` | Casos de uso: permisos finos, estado, transacciones, auditoría y difusión | Conocer HTTP (solo lanzan `HttpError`) |
| Dominio puro | `services/pairing/`, `standings.calculator.ts`, `dashboard/playerStats.ts`, `tournamentStats.service.ts` (`summarizeBoards`), `exports/officialDocuments.ts` | Cálculo sin E/S: emparejar, clasificar, agregar, armar documentos | Tocar la BD |

Los servicios reciben el cliente de Prisma como parámetro (inversión de dependencias). Eso permite probarlos con dobles y pasarles un cliente transaccional cuando una operación debe ser atómica.

### Decisiones clave

- **Reglas de acceso en un solo lugar.** `services/tournamentAccess.ts` responde "¿puede este usuario hacer X en este torneo?" (administrar, ver, registrar resultados, exportar) y "¿el estado del torneo lo permite?" (HU17). `dashboard/scopes.ts` responde "¿de qué jugadores puede ver datos?". Así, ninguna regla está repetida en varios servicios.
- **El dominio no conoce la BD.** El motor suizo (`pairing/swissPairing.ts`) recibe candidatos y devuelve mesas. `pairing/pairingHistory.ts` traduce el historial guardado a esos candidatos. El seeder usa exactamente ese mismo código, así que los datos de prueba salen del mismo motor que producción.
- **La clasificación se reconstruye completa** en cada cambio de resultado, dentro de la misma transacción, y guarda el puesto oficial (`standings.rank`). Nunca se parchea de forma incremental: una corrección (HU11) no puede dejar números viejos.
- **Auditoría atómica (RN-11).** Toda acción crítica escribe su entrada de bitácora con el mismo cliente transaccional que la acción, así que se confirman juntas o no se confirma ninguna.
- **La sesión se verifica en cada petición.** `requireAuth` valida la firma del JWT y además confirma en la BD que la cuenta sigue activa y conserva el rol que dice el token. Un bloqueo, una supresión de datos (HU22) o un cambio de rol surten efecto en la siguiente petición.
- **La sesión es una cookie que ningún script lee.** El JWT viaja en una cookie `HttpOnly` y `SameSite=Lax` que pone el login, así que un XSS no puede llevárselo. Un cambio que llega con la cookie desde otro origen se rechaza (`CROSS_SITE_REQUEST`, defensa contra CSRF). En producción, Vercel reescribe `/api` hacia Render para que la cookie sea del mismo sitio que la app. El socket va directo a Render y se identifica con un ticket de un minuto firmado para otra audiencia, que no sirve como sesión. Detalles en [`despliegue.md`](despliegue.md).
- **Extensión sin modificación (abierto/cerrado).** Un widget nuevo del panel se agrega con su clave en el catálogo, su cargador en `widgetRegistry.ts` y su componente en el frontend. No se tocan rutas ni controladores.
- **Difusión después de confirmar.** Los eventos de Socket.IO se emiten fuera de las transacciones, así que ningún cliente se entera de un cambio que luego se revierte.

## Frontend (`frontend/src`)

| Carpeta | Responsabilidad |
|---|---|
| `views/` | Pantallas por ruta, agrupadas por rol. Componen componentes; no llaman a axios directamente |
| `components/` | Piezas reutilizables: `ui/` genéricas, `layout/` encabezado y menús, `charts/` gráficos, `dashboard/` widgets, `tournament/` sala y mesas, `tournament-admin/` gestión, `account/` perfil y privacidad, `home/` portada |
| `queries/` (Pinia Colada) | Datos del servidor en caché: la clave y la petición de cada lectura, y cómo la actualiza cada cambio |
| `stores/` (Pinia) | Estado del cliente: sesión, tema, idioma, diálogo de confirmación |
| `services/` | Un módulo por recurso de la API. Es la única capa que conoce URLs y formatos |
| `lib/` | Composables y utilidades sin estado global: formato y fechas, acceso por rol, datos de widgets, tiempo real, expiración de sesión, carga anticipada, estado en la URL |
| `i18n/` | Textos en español (van en el arranque) e inglés (se descarga al elegirlo) |

Decisiones:

- **Arranque mínimo.** Solo la portada y el login van en el paquete inicial. Al arrancar se cargan la app (83 KB, 24 KB gzip), Vue con sus plugins en un solo archivo (192 KB, 71 KB gzip) y el CSS (62 KB, 12 KB gzip). Todo lo demás llega cuando hace falta: cada página, el cliente de Socket.IO (solo en las vistas en vivo), el selector de fechas, el menú de usuario, el diálogo de confirmación y el inglés.
- **Datos en paralelo con el código.** Las páginas pesadas (panel, sala del torneo, gestión del torneo) inician sus peticiones en el `beforeEnter` de su ruta, antes de que se descargue su código, y la página toma la petición en vuelo al montarse. Lo hacen con la caché de Pinia Colada (`queries/`), la misma de la que leen las páginas: cada dato tiene su clave (todo lo de un torneo bajo `["tournament", id]`), así que las respuestas tardías de otra página no pisan la actual, y las peticiones repetidas se comparten. El panel lleva además el usuario en la clave, para que en un computador compartido nadie vea el del anterior. Los widgets del panel cargan código y datos juntos al acercarse a la pantalla, y el código de una página se precarga cuando el usuario pasa por su enlace.
- **Despliegues sin pestañas rotas.** Los archivos compilados llevan un hash en el nombre y se cachean un año; `index.html` nunca. Una pestaña abierta antes de un despliegue que ya no encuentra un archivo pasa a navegar con recargas completas, que traen la versión nueva (`lib/staleChunks.ts`).
- **Sesión expirada o invalidada.** `services/api.ts` detecta un 401 mientras hay sesión abierta y avisa a `lib/sessionExpiry.ts`, que limpia la sesión local y lleva al login con un mensaje y la ruta de regreso. El gancho evita el ciclo de imports entre `api.ts` y el store.
- **Tiempo real con coalescencia.** `lib/useTournamentLive.ts` entra a la sala del torneo, vuelve a entrar tras cada reconexión, escucha todo el catálogo de eventos y agrupa ráfagas en un solo refresco. El store de rondas descarta respuestas tardías de un torneo que el usuario ya dejó.
- **Estado en la URL.** La pestaña, la ronda, el jugador o el club seleccionados viven en la query (`lib/useQueryParam.ts`): sobreviven a una recarga y un enlace copiado abre la página igual.
- **Fechas de calendario.** Las fechas de torneo se guardan como medianoche UTC y se muestran en UTC (`lib/format.ts`); lo que el usuario escribe en un campo de fecha es un día de su calendario local (`lib/dates.ts`). Así ninguna fecha se corre un día en Colombia.
- **Accesibilidad.** Menús, pestañas y diálogos sobre reka-ui; enlace para saltar al contenido; el foco se conserva cuando un control se reemplaza a sí mismo; los errores de formulario quedan atados a su campo; cargas, errores y éxitos se anuncian en regiones vivas; las acciones con consecuencias se confirman con un diálogo propio en lugar de `window.confirm`.
- **Registros tipados.** `components/dashboard/widgetRegistry.ts` es un `Record<WidgetKey, …>`: si falta el componente de un widget, el build falla.
- **Tipos de prueba separados.** Los tests se chequean con `tsconfig.vitest.json` (con tipos de Node, porque corren en Node). El código de la app no tiene esos tipos, así que no puede usar APIs de Node por accidente.

## Contratos entre frontend y backend

Son dos proyectos npm, pero comparten el contrato de la API: [`backend/src/contracts/`](../backend/src/contracts/) define los catálogos, los códigos de error y los tipos de cada respuesta, y el frontend compila contra esos mismos archivos con el alias `@contracts` (sus servicios convierten cada tipo a su forma JSON con `Serialized<T>`: las fechas llegan como texto). Un campo renombrado, quitado o con un valor nuevo no compila del lado que no lo sigue. La carpeta no depende de nada fuera de ella, para que los dos proyectos la puedan compilar, y el backend comprueba que los enums de la base y los esquemas de validación acepten exactamente los valores del contrato. Del lado del frontend quedan dos pruebas: `contracts.test.ts`, que cada valor que la interfaz muestra tenga texto en los dos idiomas, y `services/http.test.ts`, que fija la URL, el método y el cuerpo exactos de cada llamada a la API.

## Revisión de arquitectura (septiembre de 2026)

### Hallazgos corregidos

| Hallazgo | Impacto | Corrección |
|---|---|---|
| El frontend enviaba `type: "ACCESO"`/`"SUPRESION"`, pero la API solo acepta `"ACCESS"`/`"SUPPRESSION"` | **HU22 no funcionaba**: toda solicitud de derechos ARCO respondía 400 | Contrato alineado, más el test de contrato que lo detecta |
| La supresión de datos anonimizaba el usuario pero dejaba fecha de nacimiento, género y discapacidad en el perfil de jugador | Datos sensibles conservados (Ley 1581, art. 5) | Se borran todos los datos personales del perfil, salvo lo necesario para leer resultados históricos |
| El JWT se aceptaba hasta su vencimiento aunque la cuenta se bloqueara o cambiara de rol | Una cuenta bloqueada seguía operando hasta 24 h | `requireAuth` verifica en la BD que la sesión sigue vigente, y el cliente vuelve al login |
| La bitácora se escribía *después* de confirmar la acción | Una acción crítica podía quedar sin auditar | Auditoría dentro de la misma transacción, en los 7 puntos |
| Dos clics simultáneos en "Generar ronda" | Error 500 | 409 con un mensaje claro |
| Un jugador retirado después de generar el borrador se publicaba igual | Violación de RN-07 | Publicar un borrador así se rechaza |
| `roundsCount` configurable por debajo de las rondas ya generadas | Torneo en estado incoherente | Se rechaza (409) |
| El bye de un borrador contaba en las estadísticas del panel | Puntos antes de publicarse (RN-04) | Solo cuentan partidas de rondas publicadas |
| Fechas de torneo formateadas en la zona del navegador | En Colombia se mostraba **el día anterior** | Formateo en UTC para fechas de calendario; test que corre en hora de Bogotá |
| Sonneborn-Berger mostrado con un decimal | Dos jugadores empatados podían verse distintos | Dos decimales en la tabla y en el PDF |
| Paquete JS único de más de 500 KB | Carga inicial lenta | Rutas con carga diferida (134 KB) |
| Validación, errores de unicidad y descarga de archivos copiados en varios módulos | Duplicación | `parseOrThrow`, `prismaErrors.ts` y `lib/download.ts` compartidos |
| Tipo de registro escrito a mano que admitía roles que la API rechaza | Tipo engañoso | Derivado del esquema zod |
| La bitácora se devolvía completa en cada consulta | Respuesta sin límite a medida que crece | Paginación por cursor (50 entradas por página, máximo 100) con índice sobre `(created_at, id)` |
| El evento `player.withdrawn` estaba en el catálogo, pero ningún servicio lo emitía | La sala en vivo no mostraba un retiro hasta recargar, aunque `DOCUMENTACION.md` lo especifica | Se emite al confirmar el retiro, y nunca si la acción falla. Lo cubren pruebas del servicio y del composable de tiempo real, y una prueba contra la API real |

### Historias completadas en esta revisión

- **HU15**: widget "Historial de partidas" (rival, color y resultado de cada partida).
- **HU16**: estadísticas del torneo en la sala: participación, partidas decisivas, rendimiento de blancas y reparto por ronda.
- **HU30**: exportación a PDF de la clasificación y de los emparejamientos de una ronda, para árbitros y el organizador. El documento incluye la fecha y hora de generación.
- **HU18**: la sala en vivo ahora es accesible también desde "Mis torneos" del jugador, desde los torneos del entrenador y desde el widget de próximos torneos.

### Recomendaciones no aplicadas

- **Emparejamiento imposible**: si ninguna combinación evita repetir un enfrentamiento, la generación se rechaza. Una mejora sería generar el borrador marcando la repetición, para que el organizador la autorice con un ajuste manual (RN-02).
- **Paginación del listado de usuarios** si el sistema escala más allá de una universidad. La bitácora ya se pagina.

## Estrategia de pruebas

| Nivel | Qué cubre | Dónde |
|---|---|---|
| Dominio puro | Emparejamiento, desempates, agregaciones y documentos, sin BD | `services/pairing/*.test.ts`, `standings.calculator.test.ts`, etc. |
| Servicios | Reglas, permisos, estados y atomicidad, con Prisma simulado | `services/**/*.test.ts` |
| HTTP | Códigos de estado, compuertas de rol, validación y cabeceras | `routes/*.test.ts` |
| Integración | Lo que solo la base puede probar: restricciones, transacciones, bloqueos y carreras, supresión de datos, Socket.IO de punta a punta | `backend/src/**/*.int.test.ts` (PostgreSQL real) |
| Componentes y vistas | Interacción, estados vacíos y de error, accesibilidad básica | `frontend/src/**/*.test.ts` |
| Vistas por HTTP | Páginas a través del cliente HTTP real contra una API simulada (MSW): la API en el propio origen sin token a la vista, la sesión que vence, forma real de los errores | `frontend/src/views/overHttp.test.ts` |
| Navegador (E2E) | Flujos entre roles con Playwright: el build de producción con su CSP, la API real y una base propia sembrada; la cookie de sesión invisible para los scripts y revocada al salir | `frontend/e2e/*.spec.ts` |
| Contratos | Contrato compartido (lo verifica el compilador), enums de la base, textos de cada catálogo y llamadas a la API | `backend/src/contracts/contracts.test.ts`, `contracts.test.ts`, `services/http.test.ts` |
| Despliegue | Reglas de caché, la reescritura de `/api` hacia el backend y la CSP de `vercel.json` | `deployment.test.ts` |

```bash
npm test               # en backend/ y en frontend/
npm run test:coverage  # informe de cobertura en coverage/
```

Cobertura actual: backend 97 % de líneas y 90 % de ramas (545 tests: 472 unitarios y 73 de integración contra PostgreSQL); frontend 95 % de líneas y 88 % de ramas (571 tests, más 9 de navegador con Playwright).
