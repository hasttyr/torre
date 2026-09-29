# Backend — Torre Central Hub

API REST y canal de tiempo real de Torre Central Hub: Express 5 + TypeScript, Prisma 7 sobre PostgreSQL (con el adaptador `@prisma/adapter-pg`), Socket.IO 4, validación con zod y PDF con pdfkit.

La visión general del sistema está en el [README raíz](../README.md), y las decisiones de arquitectura en [`docs/arquitectura.md`](../docs/arquitectura.md).

## Puesta en marcha

Requisitos: Node.js 22.12 o superior y una base PostgreSQL.

```bash
npm install
cp .env.example .env        # completar DATABASE_URL y JWT_SECRET
npm run prisma:generate     # genera el cliente de Prisma en src/generated/ (no se versiona)
npm run prisma:migrate      # crea la base de datos y aplica las migraciones
npm run prisma:seed         # opcional: cuentas por rol y torneos de ejemplo
npm run dev                 # http://localhost:4000 — GET /api/health responde {"status":"ok"}
```

Las cuentas que crea el seed (todas con contraseña `Test1234`) están en el [README raíz](../README.md#datos-de-prueba).

## Variables de entorno

| Variable         | Por defecto                  | Uso                                                                                                                                                                                                                                                         |
| ---------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | — (obligatoria)              | Conexión a PostgreSQL                                                                                                                                                                                                                                       |
| `JWT_SECRET`     | — (obligatoria)              | Firma de los tokens de sesión. En producción, al menos 32 caracteres aleatorios (`openssl rand -hex 32`)                                                                                                                                                    |
| `JWT_EXPIRES_IN` | `1d`                         | Vigencia de un token                                                                                                                                                                                                                                        |
| `NODE_ENV`       | `development`                | `production` activa las exigencias de producción (secreto fuerte, proveedor de correo)                                                                                                                                                                      |
| `PORT`           | `4000`                       | Puerto HTTP y de Socket.IO                                                                                                                                                                                                                                  |
| `CORS_ORIGIN`    | `http://localhost:5173`      | Origen del frontend (`https://…`, sin ruta): el que admiten CORS y Socket.IO, y desde el que se aceptan cambios con la cookie de sesión                                                                                                                     |
| `APP_URL`        | el de `CORS_ORIGIN`          | Dirección pública del frontend: base de los enlaces que la API envía por correo                                                                                                                                                                             |
| `SMTP_URL`       | —                            | Proveedor de correo para los enlaces de recuperación, p. ej. `smtps://usuario:clave@smtp.proveedor.com:465`. En producción, sin él la recuperación de contraseña queda desactivada (responde `503 PASSWORD_RESET_UNAVAILABLE`); el resto de la app funciona |
| `MAIL_FROM`      | — (con `SMTP_URL`)           | Remitente de esos correos, p. ej. `Torre Central Hub <no-reply@dominio>`                                                                                                                                                                                    |
| `APP_TIMEZONE`   | `America/Bogota`             | Zona horaria de las fechas que escribe el servidor (p. ej. en los PDF)                                                                                                                                                                                      |
| `TRUST_PROXY`    | — (ningún proxy)             | Detrás de un proxy inverso, cuántos saltos confiar, para que la IP del cliente sea la real y no la del proxy. Con Vercel delante de Render, `2` ([`docs/despliegue.md`](../docs/despliegue.md))                                                             |
| `LOG_LEVEL`      | `info` (`silent` en pruebas) | Nivel de los logs: `trace`, `debug`, `info`, `warn`, `error`, `fatal` o `silent`                                                                                                                                                                            |

Las variables se validan al arrancar ([`src/config/env.ts`](src/config/env.ts)): si falta una obligatoria o un valor no sirve (un `PORT` que no es número, un `JWT_SECRET` de menos de 32 caracteres en producción, un `CORS_ORIGIN` que no es una dirección `http(s)`), el servidor no arranca y dice cuál es. Producción sin `SMTP_URL` sí arranca: solo la recuperación de contraseña queda desactivada, y el log lo avisa al arrancar.

## Scripts

| Script                            | Qué hace                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`                     | Servidor con recarga automática (`tsx watch`)                                 |
| `npm run build` / `npm start`     | Compila a `dist/`; aplica las migraciones pendientes y lo ejecuta             |
| `npm test`                        | Pruebas con Vitest (`test:watch` en modo observador)                          |
| `npm run test:coverage`           | Pruebas con informe de cobertura en `coverage/`                               |
| `npm run lint`                    | ESLint sobre `src/`                                                           |
| `npm run format` / `format:check` | Prettier                                                                      |
| `npm run prisma:migrate`          | Crea y aplica migraciones (`prisma migrate dev`)                              |
| `npm run prisma:generate`         | Genera el cliente de Prisma (`build` lo hace solo)                            |
| `npm run prisma:studio`           | Explorador visual de la base                                                  |
| `npm run prisma:seed`             | Carga los datos de prueba (idempotente)                                       |
| `npm run bootstrap`               | Prepara una base nueva de producción (ver abajo)                              |
| `npm run audit:link-names`        | Liga los nombres de entradas de auditoría antiguas a sus personas (ver abajo) |
| `npm run passwords:legacy`        | Cuántas cuentas conservan un hash bcrypt (ver abajo)                          |
| `npm run benchmark`               | Mide las consultas que crecen con los datos, sobre la base de pruebas         |
| `npm run e2e:prepare`             | Migra, vacía y siembra la base de la suite de navegador                       |
| `npm run e2e:server`              | La API sobre esa base (la levanta Playwright)                                 |

En producción el seed se niega a correr: sus cuentas de prueba comparten una contraseña escrita en el repositorio. Una base nueva se prepara, después de `npm run build` y de aplicar las migraciones (`npx prisma migrate deploy`), con:

```bash
ADMIN_NAME="…" ADMIN_EMAIL="…" ADMIN_PASSWORD="…" npm run bootstrap
```

Crea lo que falte del catálogo de roles y de los paneles por defecto ([`src/services/referenceData.ts`](src/services/referenceData.ts), el mismo que usa el seed) y, si no hay ningún administrador activo, el primero, con las reglas de contraseña del registro. Se puede repetir: no crea un segundo administrador, no toca lo que un administrador ya configuró y nunca convierte una cuenta existente en administradora.

Dos comandos más, de una sola vez, para una base con datos anteriores a la revisión de septiembre de 2026 (también después de `npm run build`):

- `npm run audit:link-names` ([`src/scripts/migrateLegacyAuditDetails.ts`](src/scripts/migrateLegacyAuditDetails.ts)): las entradas de auditoría de antes guardan nombres como texto, que una supresión (HU22) no alcanza. El comando reemplaza cada nombre que corresponde a una sola persona por su referencia, así la bitácora se lee igual hasta que esa persona pida suprimir sus datos. Sin argumentos solo informa qué haría; con `-- --apply` lo escribe, en una transacción. Lo que no puede atribuir a una sola persona (dos personas con el mismo nombre, un nombre que ya nadie tiene) lo deja como está y lo lista para revisión.
- `npm run passwords:legacy` ([`src/scripts/legacyPasswordHashes.ts`](src/scripts/legacyPasswordHashes.ts)): cuántas cuentas conservan un hash bcrypt. Cada uno se reemplaza por scrypt cuando su dueño vuelve a iniciar sesión; cuando el conteo llega a 0, `bcryptjs` sobra.

`npm run benchmark` ([`src/testing/benchmark.ts`](src/testing/benchmark.ts)) llena la base de la suite de integración con unas diez veces los datos de una universidad (1000 jugadores, 100 torneos, 14 000 partidas) y mide las consultas que crecen con ellos. En septiembre de 2026 la más lenta, el resumen de jugadores de todos, tardaba unos 95 ms: ninguna justificaba optimizarla. Conviene medir de nuevo antes de optimizar y después.

## Estructura

```
backend/
├── prisma/
│   ├── schema.prisma         # Modelo de datos
│   ├── migrations/           # Historial de migraciones
│   ├── seed.ts               # Roles, cuentas de prueba, clubes y jugadores
│   └── seeds/                # Historial de torneos y paneles por defecto
└── src/
    ├── server.ts             # Punto de entrada: HTTP + Socket.IO
    ├── app.ts                # Express: helmet, CORS, JSON, rutas bajo /api
    ├── routes/               # Método, ruta y compuerta gruesa de rol
    ├── controllers/          # Validan la entrada y llaman al servicio
    ├── validators/           # Esquemas zod de cada petición
    ├── services/             # Casos de uso: permisos finos, transacciones, auditoría, difusión
    │   ├── pairing/          # Motor suizo (sin base de datos)
    │   ├── dashboard/        # Catálogo, cargadores y alcance de los widgets del panel
    │   └── exports/          # Documentos oficiales en PDF
    ├── sockets/              # Salas por torneo y difusión de eventos
    ├── contracts/            # Contrato de la API: catálogos, códigos de error y respuestas (compartido con el frontend)
    ├── middlewares/          # requireAuth / requireRole, errores, envoltura async
    ├── config/               # Variables de entorno, cliente Prisma, versión de la política de datos
    └── types/                # Extensiones de tipos de Express
```

El contrato de la API vive en [`src/contracts/`](src/contracts/): los catálogos (roles, estados, resultados, desempates, widgets, acciones de auditoría, eventos de tiempo real…), los códigos de error y los tipos de cada respuesta. El frontend compila contra esos mismos archivos (alias `@contracts`), así que un campo renombrado o un valor nuevo que el otro lado no maneja no compila. Por eso esa carpeta no importa nada de fuera de ella (ni Prisma, ni zod, ni Node); [`contracts.test.ts`](src/contracts/contracts.test.ts) lo verifica, y también que los enums de la base y los esquemas de validación acepten exactamente los valores del contrato.

Una petición recorre ruta → controlador → servicio → Prisma. Los servicios reciben el cliente de Prisma como parámetro, así que se prueban con dobles y comparten transacción cuando una operación debe ser atómica. El cálculo puro (emparejamiento, clasificación, estadísticas, documentos) no toca la base de datos.

Dos archivos concentran las reglas de acceso: [`services/tournamentAccess.ts`](src/services/tournamentAccess.ts) decide qué puede hacer un usuario en un torneo, y [`services/dashboard/scopes.ts`](src/services/dashboard/scopes.ts) de qué jugadores puede ver datos.

## API

Todo cuelga de `/api`, habla JSON y responde con `Cache-Control: no-store`. La sesión viaja en una cookie `HttpOnly` que pone `/auth/login` (`torre_session`, `SameSite=Lax`, `Secure` en producción, `Path=/api`); la app no ve el token. También se acepta `Authorization: Bearer <token>`, para clientes que no son el navegador. Un cambio (`POST`, `PUT`, `PATCH`, `DELETE`) que llega con la cookie tiene que venir de la propia app; si no, responde `403 CROSS_SITE_REQUEST`: es la defensa contra CSRF. Los navegadores actuales lo dicen en `Sec-Fetch-Site`, una cabecera que ninguna página puede fijar (solo pasa `same-origin`); en los demás, el `Origin` (o `Referer`) tiene que ser `CORS_ORIGIN` o `APP_URL`. En cada petición se confirma en la base que la cuenta sigue activa, con el mismo rol y sin sesiones revocadas desde que se emitió el token (cambio de contraseña, cierre de sesión, cambio de rol o de estado). Los ids de las rutas son UUID: otro valor responde `400`.

Un error responde con su código HTTP y este cuerpo:

```json
{ "error": "Faltan resultados de la ronda 3", "code": "RESULTS_PENDING", "params": { "number": 3 } }
```

`code` es estable y es con lo que un cliente decide y traduce; `error` es el mensaje en español para quien no conozca el código; `params`, los valores con que se armó. Un error de validación (`VALIDATION_FAILED`) trae además `fields`, el mensaje de cada campo inválido por su ruta (`"player.semester"`). El catálogo completo de códigos está en [`src/errors/apiErrors.ts`](src/errors/apiErrors.ts).

La columna "Acceso" es la compuerta de la ruta. Los servicios afinan después: "Gestión" es el organizador **de ese torneo** o un administrador, y "Oficial" suma a cualquier árbitro.

### Sesión y cuenta

| Método   | Ruta                                   | Acceso        | Descripción                                                            |
| -------- | -------------------------------------- | ------------- | ---------------------------------------------------------------------- |
| POST     | `/auth/register`                       | Público       | Registro; guarda la aceptación de la política de datos y su versión    |
| POST     | `/auth/login`                          | Público       | Inicia la sesión (cookie `HttpOnly`) y devuelve el usuario             |
| POST     | `/auth/logout`                         | Sesión        | Cierra la sesión en todos los dispositivos y borra la cookie           |
| POST     | `/auth/socket-ticket`                  | Sesión        | Ticket de un minuto para conectarse a Socket.IO como el usuario        |
| POST     | `/auth/password/forgot`                | Público       | Pide un enlace de recuperación (misma respuesta exista o no la cuenta) |
| POST     | `/auth/password/reset`                 | Público       | Cambia la contraseña con el token del enlace                           |
| GET, PUT | `/users/me`                            | Sesión        | Perfil propio                                                          |
| GET      | `/users/me/coaches`                    | Sesión        | Entrenadores del jugador y solicitudes pendientes (`acceptedAt: null`) |
| POST     | `/users/me/coaches/:coachId/accept`    | Sesión        | Aceptar la solicitud de un entrenador (HU24)                           |
| DELETE   | `/users/me/coaches/:coachId`           | Sesión        | Rechazar la solicitud, o dejar de compartir el progreso                |
| POST     | `/users/me/data-requests`              | Sesión        | Derechos sobre datos personales: acceso, rectificación o supresión     |
| GET      | `/users`                               | Administrador | Listado de usuarios                                                    |
| PATCH    | `/users/:id/role`, `/users/:id/status` | Administrador | Cambiar el rol; activar o desactivar la cuenta                         |

Límites de peticiones ([`src/middlewares/rateLimits.ts`](src/middlewares/rateLimits.ts)): `/auth/login` admite 10 intentos fallidos cada 15 minutos por IP y correo (los estudiantes que comparten la IP del campus no se bloquean entre sí) y 100 por IP en total, contra quien prueba pocas contraseñas en muchas cuentas; `/auth/register`, 10 cuentas por hora por IP; `/auth/password/forgot`, 5 solicitudes por hora por IP y correo; y toda la API, 5000 peticiones cada 15 minutos por IP. Al pasarse responde `429` con `Retry-After`. Los contadores de inicio de sesión, registro y recuperación viven en PostgreSQL (`rate_limit_counters`, [`src/middlewares/rateLimitStore.ts`](src/middlewares/rateLimitStore.ts)): todas las instancias de la API los comparten y un reinicio no los borra. El techo de toda la API queda en la memoria de cada instancia, para no sumar una consulta a cada petición. Los límites por dirección dependen de la IP que resuelve `TRUST_PROXY`; lo que eso implica detrás de Vercel está en [`docs/despliegue.md`](../docs/despliegue.md#límites-conocidos).

### Torneos, rondas y resultados

| Método    | Ruta                                           | Acceso                     | Descripción                                             |
| --------- | ---------------------------------------------- | -------------------------- | ------------------------------------------------------- |
| GET       | `/tournaments/mine`                            | Organizador, administrador | Torneos que administra                                  |
| GET       | `/tournaments/available`                       | Sesión                     | Torneos con inscripciones abiertas                      |
| GET       | `/tournaments/enrolled`                        | Sesión                     | Torneos en los que está inscrito el jugador             |
| GET       | `/tournaments/live`                            | Sesión                     | Torneos en curso y finalizados                          |
| POST      | `/tournaments`                                 | Organizador, administrador | Crear torneo                                            |
| GET       | `/tournaments/:id`                             | Sesión                     | Detalle                                                 |
| PUT       | `/tournaments/:id/configuration`               | Gestión                    | Rondas, ritmo, desempates, valor del bye                |
| POST      | `/tournaments/:id/registration/open`, `/close` | Gestión                    | Abrir o cerrar inscripciones                            |
| GET, POST | `/tournaments/:id/players`                     | Gestión                    | Inscritos; inscribir un jugador                         |
| POST      | `/tournaments/:id/players/:playerId/withdraw`  | Gestión                    | Retirar a un jugador                                    |
| GET       | `/tournaments/:id/rounds`                      | Sesión                     | Rondas con sus mesas (los borradores solo para Gestión) |
| POST      | `/tournaments/:id/rounds`                      | Gestión                    | Generar la siguiente ronda (queda en borrador)          |
| POST      | `/rounds/:id/swap`                             | Gestión                    | Intercambiar dos jugadores de un borrador, con motivo   |
| POST      | `/rounds/:id/publish`                          | Gestión                    | Publicar un borrador                                    |
| DELETE    | `/rounds/:id`                                  | Gestión                    | Descartar un borrador                                   |
| POST, PUT | `/matches/:id/result`                          | Oficial                    | Registrar o corregir el resultado de una mesa           |
| GET       | `/tournaments/:id/standings`                   | Sesión                     | Clasificación                                           |
| GET       | `/tournaments/:id/stats`                       | Sesión                     | Estadísticas del torneo                                 |
| POST      | `/tournaments/:id/finish`                      | Gestión                    | Finalizar el torneo                                     |
| GET       | `/tournaments/:id/standings.pdf`               | Oficial                    | Clasificación en PDF                                    |
| GET       | `/rounds/:id/pairings.pdf`                     | Oficial                    | Emparejamientos de una ronda en PDF                     |

### Clubes, jugadores y entrenadores

| Método            | Ruta                             | Acceso                                 | Descripción                                  |
| ----------------- | -------------------------------- | -------------------------------------- | -------------------------------------------- |
| GET               | `/players?q=`                    | Organizador, administrador, entrenador | Buscar jugadores por nombre, correo o código |
| GET               | `/clubs`                         | Sesión                                 | Clubes                                       |
| GET               | `/clubs/:id/players`             | Organizador, administrador             | Jugadores de un club                         |
| POST, PUT, DELETE | `/clubs`, `/clubs/:id`           | Organizador, administrador             | Crear, editar o eliminar un club             |
| POST, DELETE      | `/clubs/:id/players[/:playerId]` | Organizador, administrador             | Asignar o quitar un jugador                  |
| GET, POST         | `/coaches/players`               | Entrenador                             | Jugadores seguidos; pedir seguir a uno       |
| DELETE            | `/coaches/players/:playerId`     | Entrenador                             | Dejar de seguir, o cancelar la solicitud     |
| GET               | `/coaches/tournaments`           | Entrenador                             | Torneos de los jugadores que aceptaron       |

Un entrenador pide seguir a un jugador y no ve nada de su progreso (panel, torneos) hasta que el jugador acepta (HU24, consentimiento de la Ley 1581). Cualquiera de los dos puede terminar el vínculo.

### Panel y auditoría

| Método | Ruta                         | Acceso        | Descripción                                                   |
| ------ | ---------------------------- | ------------- | ------------------------------------------------------------- |
| GET    | `/dashboard`                 | Sesión        | Widgets del panel del rol                                     |
| GET    | `/dashboard/widgets/:key`    | Sesión        | Datos de un widget (rechazado si no está en el panel del rol) |
| GET    | `/dashboard/layouts`         | Administrador | Panel de cada rol                                             |
| PUT    | `/dashboard/layouts/:role`   | Administrador | Elegir y ordenar los widgets de un rol                        |
| GET    | `/audit-logs?limit=&cursor=` | Administrador | Bitácora, de la más reciente a la más antigua                 |

La bitácora se lee por páginas: `limit` va de 1 a 100 (50 por defecto) y `cursor` es el id de la última entrada ya mostrada.

## Tiempo real

El cliente se conecta a Socket.IO en el mismo puerto de la API y entra a la sala de un torneo con `tournament:join` (y sale con `tournament:leave`), enviando el id del torneo. `tournament:join` responde (acknowledgement) si entró: solo con el id de un torneo existente, hasta 10 salas por conexión, y a un torneo en borrador (`CREATED`) solo si quien se conecta lo administra, igual que en REST. Para eso el handshake puede llevar un ticket (`auth: { ticket }`) que se pide con la sesión en `POST /api/auth/socket-ticket`: vale un minuto y solo para Socket.IO, porque el socket puede ir directo al backend, adonde la cookie no llega (en producción, Vercel no reescribe WebSockets). El token de sesión no sirve como ticket. Sin ticket, la conexión es anónima y sigue los torneos publicados. Desde la sala recibe:

| Evento                  | Cuándo                                                                     |
| ----------------------- | -------------------------------------------------------------------------- |
| `pairing.published`     | Se publica una ronda                                                       |
| `pairing.adjusted`      | Se intercambian jugadores en un borrador (solo a quienes lo administran)   |
| `match.result.recorded` | Se registra o corrige un resultado                                         |
| `standings.updated`     | Cambia la clasificación (tras publicar una ronda o registrar un resultado) |
| `player.withdrawn`      | Se retira un jugador (la clasificación y las estadísticas lo reflejan)     |
| `tournament.finished`   | Se finaliza el torneo                                                      |

Los eventos solo avisan qué cambió (ids y poco más) y se emiten después de confirmar la transacción: si la acción falla, nadie se entera. El cliente vuelve a pedir por REST lo que necesita, con sus permisos. Lo que todavía no es público (un borrador de ronda) va a una sala aparte con los administradores del torneo.

El catálogo de eventos (`SOCKET_EVENTS`) es parte del contrato ([`src/contracts/catalogs.ts`](src/contracts/catalogs.ts)): el frontend usa el mismo, y su sala se refresca con cualquier evento de él.

## Recuperación de contraseña

`POST /auth/password/forgot` envía al titular un enlace `APP_URL/restablecer-password?token=<token>`, que vale una hora y un solo uso. El envío pasa por un puerto, [`services/resetLinkSender.ts`](src/services/resetLinkSender.ts): con `SMTP_URL` sale por correo; sin él, en desarrollo, el enlace se escribe en la consola del servidor (`[password-reset] Enlace … para <correo>: <enlace>`). En producción nunca va a la consola, porque un token en los logs permite tomar la cuenta: sin proveedor, la ruta responde `503 PASSWORD_RESET_UNAVAILABLE` a cualquier correo (así no delata cuáles existen) y la app dice que la recuperación no está disponible. El envío no se espera: ni su demora ni un fallo del proveedor delatan si el correo existe.

## Base de datos

- El modelo vive en [`prisma/schema.prisma`](prisma/schema.prisma). Para cambiarlo: editar el esquema, correr `npm run prisma:migrate -- --name <descripcion>`, que genera y aplica la migración, y después `npm run prisma:generate`, que regenera el cliente (Prisma 7 ya no lo hace solo, ni corre el seed).
- El cliente se genera en `src/generated/prisma` (ignorado por git, lint, formato y cobertura) y se compila con la app como CommonJS. La conexión la da `DATABASE_URL`: a la app por [`config/prisma.ts`](src/config/prisma.ts) (adaptador `@prisma/adapter-pg`) y a la CLI por [`prisma.config.ts`](prisma.config.ts).
- Problema conocido: al cargar una consulta con varias relaciones (`include`) dentro de una transacción, Prisma 7 lanza sus consultas en paralelo sobre la conexión de la transacción y `pg` avisa una vez por proceso (`DeprecationWarning: Calling client.query() when the client is already executing a query…`). `pg` 8 las encola y el resultado es correcto; en `pg` 9 será un error, así que actualizar `@prisma/adapter-pg` a `pg` 9 exige que Prisma lo resuelva antes ([prisma/prisma#29407](https://github.com/prisma/prisma/issues/29407)).
- `overrides` en `package.json` sube dos dependencias de la CLI de Prisma 7.10 que fija versiones con avisos de seguridad, y que harían fallar `npm audit` en CI: `deepmerge-ts` a la 8 ([GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)) y `mysql2` ([GHSA-3f6p-5ww8-9rcr](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr); el proyecto no usa MySQL). Se pueden quitar cuando Prisma las actualice: sin ellas, `npm audit` lo dice.
- Las restricciones que Prisma no expresa, como los `CHECK`, van a mano en el SQL de la migración (ver `migrations/*_add_check_constraints`).
- Todos los ids (claves primarias y foráneas) son `uuid` nativos de PostgreSQL (`@db.Uuid`): la base rechaza cualquier otro valor. Un cambio de tipo con datos se escribe a mano (ver `migrations/*_native_uuid_ids`): el borrador de Prisma borra y vuelve a crear las columnas.
- El seed usa el mismo motor de emparejamiento y la misma calculadora de clasificación que la app, así que los torneos de ejemplo son coherentes con lo que produciría el sistema.

## Pruebas

```bash
npm test                  # unitarias: sin base de datos
npm run test:integration  # contra PostgreSQL real
npm run test:coverage     # las dos, con los umbrales de cobertura
```

Las pruebas unitarias no necesitan base de datos ni `.env`: Prisma se simula y [`vitest.setup.ts`](vitest.setup.ts) fija valores de prueba para las variables obligatorias. Hay tres niveles:

- **Dominio puro**: emparejamiento, desempates, estadísticas y documentos (`services/pairing/*.test.ts`, `standings.calculator.test.ts`…).
- **Servicios**: reglas, permisos y estados (`services/**/*.test.ts`).
- **HTTP**: códigos de estado, compuertas de rol y validación, con Supertest (`routes/*.test.ts`).

Lo que solo la base de datos puede probar (restricciones, transacciones, bloqueos, carreras entre peticiones concurrentes, la supresión de datos de HU22, Socket.IO de punta a punta) va en la suite de integración, `*.int.test.ts` (proyecto `integration` de [`vitest.config.mts`](vitest.config.mts)). Usa `TEST_DATABASE_URL`, o si no está, la base de `DATABASE_URL` con el sufijo `_test` (`torre_central_hub_test`): le aplica las migraciones (`migrate deploy`, la crea la primera vez) y vacía las tablas antes de cada prueba. Se niega a correr contra una base cuyo nombre no termine en `_test`, y `resetDatabase` lo vuelve a comprobar sobre la conexión (`current_database()`) antes de vaciar nada. Las carreras se reproducen de forma determinista: la prueba toma el bloqueo del torneo, lanza la petición y confirma un cambio mientras ella espera (`raceWithChange` en [`src/testing/testDatabase.ts`](src/testing/testDatabase.ts)).

Las pruebas viven junto al archivo que prueban (`x.ts` → `x.test.ts`, `x.int.test.ts`).

La cobertura cuenta las dos suites juntas y tiene umbrales en `vitest.config.mts` (los niveles actuales, para que solo pueda subir). En cada push y pull request, [GitHub Actions](../.github/workflows/ci.yml) corre lint, tipos, formato, las dos suites con cobertura contra un PostgreSQL de servicio, el build (y verifica que no incluya pruebas) y `npm audit`.

## Cómo extender

- **Un endpoint nuevo**: esquema zod en `validators/` (con los campos compartidos de `validators/fields.ts`, que ya traen su longitud máxima), caso de uso en `services/` (que lanza `new HttpError("CODIGO")` para los errores esperados; un código nuevo se agrega al catálogo de `contracts/errors.ts` y a `apiErrors` en las traducciones del frontend; el tipo de lo que responde, a `contracts/responses.ts`), controlador `async` en `controllers/` que valida con `parseOrThrow` y llama al servicio (Express 5 lleva sus errores al `errorHandler`, sin try/catch), y la ruta en `routes/` con su `requireAuth` / `requireRole`. Si es un recurso nuevo, se monta en [`routes/index.ts`](src/routes/index.ts).
- **Un cambio a un torneo** (su estado, rondas, resultados o inscripciones): dentro de una transacción que empieza con `lockTournament(tx, id)` ([`services/tournamentAccess.ts`](src/services/tournamentAccess.ts)), y con las validaciones después del bloqueo. Así dos cambios al mismo torneo nunca se intercalan (p. ej. un resultado registrado mientras el torneo finaliza).
- **Una acción crítica**: su entrada de bitácora se escribe con el mismo cliente transaccional que la acción ([`services/auditLog.service.ts`](src/services/auditLog.service.ts)), para que se confirmen juntas. Las personas se nombran con `mention(userId)`, nunca por su nombre: la bitácora pone el nombre al leerse, así una supresión (HU22) también la anonimiza.
- **Un aviso en tiempo real**: el evento se agrega en `sockets/events.ts` y en su copia del frontend, y se emite con `emitToTournament` después de la transacción.
- **Un widget del panel**: clave en `services/dashboard/widgetCatalog.ts`, cargador en `services/dashboard/widgetRegistry.ts` y componente en `frontend/src/components/dashboard/widgetRegistry.ts`. No se tocan rutas ni controladores.
