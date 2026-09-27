# Backend — Torre Central Hub

API REST y canal de tiempo real de Torre Central Hub: Express 4 + TypeScript, Prisma 6 sobre PostgreSQL, Socket.IO 4, validación con zod y PDF con pdfkit.

La visión general del sistema está en el [README raíz](../README.md), y las decisiones de arquitectura en [`docs/arquitectura.md`](../docs/arquitectura.md).

## Puesta en marcha

Requisitos: Node.js 22.12 o superior y una base PostgreSQL.

```bash
npm install
cp .env.example .env        # completar DATABASE_URL y JWT_SECRET
npm run prisma:migrate      # crea la base de datos y aplica las migraciones
npm run prisma:seed         # opcional: cuentas por rol y torneos de ejemplo
npm run dev                 # http://localhost:4000 — GET /api/health responde {"status":"ok"}
```

Las cuentas que crea el seed (todas con contraseña `Test1234`) están en el [README raíz](../README.md#datos-de-prueba).

## Variables de entorno

| Variable         | Por defecto             | Uso                                                                                                                       |
| ---------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | — (obligatoria)         | Conexión a PostgreSQL                                                                                                     |
| `JWT_SECRET`     | — (obligatoria)         | Firma de los tokens de sesión                                                                                             |
| `JWT_EXPIRES_IN` | `1d`                    | Vigencia de un token                                                                                                      |
| `PORT`           | `4000`                  | Puerto HTTP y de Socket.IO                                                                                                |
| `CORS_ORIGIN`    | `http://localhost:5173` | Origen del frontend, para REST y Socket.IO                                                                                |
| `APP_TIMEZONE`   | `America/Bogota`        | Zona horaria de las fechas que escribe el servidor (p. ej. en los PDF)                                                    |
| `TRUST_PROXY`    | — (ningún proxy)        | Detrás de un proxy inverso, cuántos saltos confiar (p. ej. `1`), para que la IP del cliente sea la real y no la del proxy |

Si falta una variable obligatoria, el servidor no arranca y dice cuál es ([`src/config/env.ts`](src/config/env.ts)).

## Scripts

| Script                            | Qué hace                                             |
| --------------------------------- | ---------------------------------------------------- |
| `npm run dev`                     | Servidor con recarga automática (`tsx watch`)        |
| `npm run build` / `npm start`     | Compila a `dist/` y lo ejecuta                       |
| `npm test`                        | Pruebas con Vitest (`test:watch` en modo observador) |
| `npm run test:coverage`           | Pruebas con informe de cobertura en `coverage/`      |
| `npm run lint`                    | ESLint sobre `src/`                                  |
| `npm run format` / `format:check` | Prettier                                             |
| `npm run prisma:migrate`          | Crea y aplica migraciones (`prisma migrate dev`)     |
| `npm run prisma:generate`         | Regenera el cliente de Prisma                        |
| `npm run prisma:studio`           | Explorador visual de la base                         |
| `npm run prisma:seed`             | Carga los datos de prueba (idempotente)              |

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
    ├── sockets/              # Salas por torneo y catálogo de eventos
    ├── middlewares/          # requireAuth / requireRole, errores, envoltura async
    ├── config/               # Variables de entorno, cliente Prisma, versión de la política de datos
    └── types/                # Extensiones de tipos de Express
```

Una petición recorre ruta → controlador → servicio → Prisma. Los servicios reciben el cliente de Prisma como parámetro, así que se prueban con dobles y comparten transacción cuando una operación debe ser atómica. El cálculo puro (emparejamiento, clasificación, estadísticas, documentos) no toca la base de datos.

Dos archivos concentran las reglas de acceso: [`services/tournamentAccess.ts`](src/services/tournamentAccess.ts) decide qué puede hacer un usuario en un torneo, y [`services/dashboard/scopes.ts`](src/services/dashboard/scopes.ts) de qué jugadores puede ver datos.

## API

Todo cuelga de `/api` y habla JSON. Las rutas protegidas esperan `Authorization: Bearer <token>`, y en cada petición se confirma en la base que la cuenta sigue activa y con el mismo rol. Un error responde `{ "error": "<mensaje>" }` con su código HTTP.

La columna "Acceso" es la compuerta de la ruta. Los servicios afinan después: "Gestión" es el organizador **de ese torneo** o un administrador, y "Oficial" suma a cualquier árbitro.

### Sesión y cuenta

| Método   | Ruta                                   | Acceso        | Descripción                                                            |
| -------- | -------------------------------------- | ------------- | ---------------------------------------------------------------------- |
| POST     | `/auth/register`                       | Público       | Registro; guarda la aceptación de la política de datos y su versión    |
| POST     | `/auth/login`                          | Público       | Devuelve el token y el usuario                                         |
| POST     | `/auth/logout`                         | Sesión        | Cierra la sesión                                                       |
| POST     | `/auth/password/forgot`                | Público       | Pide un enlace de recuperación (misma respuesta exista o no la cuenta) |
| POST     | `/auth/password/reset`                 | Público       | Cambia la contraseña con el token del enlace                           |
| GET, PUT | `/users/me`                            | Sesión        | Perfil propio                                                          |
| GET      | `/users/me/coaches`                    | Sesión        | Entrenadores vinculados al jugador                                     |
| POST     | `/users/me/data-requests`              | Sesión        | Derechos sobre datos personales: acceso, rectificación o supresión     |
| GET      | `/users`                               | Administrador | Listado de usuarios                                                    |
| PATCH    | `/users/:id/role`, `/users/:id/status` | Administrador | Cambiar el rol; activar o desactivar la cuenta                         |

Contra fuerza bruta, `/auth/login` admite 10 intentos fallidos cada 15 minutos y `/auth/password/forgot` 5 solicitudes por hora, contados por IP y correo: los estudiantes que comparten la IP del campus no se bloquean entre sí. Al pasarse responde `429` con `Retry-After` ([`src/middlewares/rateLimits.ts`](src/middlewares/rateLimits.ts)).

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
| GET               | `/clubs`, `/clubs/:id/players`   | Sesión                                 | Clubes y sus jugadores                       |
| POST, PUT, DELETE | `/clubs`, `/clubs/:id`           | Organizador, administrador             | Crear, editar o eliminar un club             |
| POST, DELETE      | `/clubs/:id/players[/:playerId]` | Organizador, administrador             | Asignar o quitar un jugador                  |
| GET, POST         | `/coaches/players`               | Entrenador                             | Jugadores vinculados; vincular uno           |
| DELETE            | `/coaches/players/:playerId`     | Entrenador                             | Desvincular                                  |
| GET               | `/coaches/tournaments`           | Entrenador                             | Torneos de sus jugadores                     |

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

El cliente se conecta a Socket.IO en el mismo puerto de la API y entra a la sala de un torneo con `tournament:join` (y sale con `tournament:leave`), enviando el id del torneo. Desde ahí recibe:

| Evento                  | Cuándo                                                                     |
| ----------------------- | -------------------------------------------------------------------------- |
| `pairing.published`     | Se publica una ronda                                                       |
| `pairing.adjusted`      | Se intercambian jugadores en un borrador                                   |
| `match.result.recorded` | Se registra o corrige un resultado                                         |
| `standings.updated`     | Cambia la clasificación (tras publicar una ronda o registrar un resultado) |
| `player.withdrawn`      | Se retira un jugador (la clasificación y las estadísticas lo reflejan)     |
| `tournament.finished`   | Se finaliza el torneo                                                      |

Los eventos solo avisan qué cambió (ids y poco más) y se emiten después de confirmar la transacción: si la acción falla, nadie se entera. El cliente vuelve a pedir por REST lo que necesita, con sus permisos, así que entrar a la sala no requiere sesión.

El catálogo está duplicado a propósito en [`src/sockets/events.ts`](src/sockets/events.ts) y `frontend/src/services/socket.ts`: si cambia uno, hay que cambiar el otro. `frontend/src/contracts.test.ts` falla si no coinciden, y la sala del frontend se refresca con cualquier evento del catálogo.

## Recuperación de contraseña en desarrollo

No hay proveedor de correo configurado. `POST /auth/password/forgot` escribe el token en la consola del servidor (`[password-reset] … token=…`), y el enlace de recuperación es `http://localhost:5173/restablecer-password?token=<token>`. El token vale una hora y un solo uso.

## Base de datos

- El modelo vive en [`prisma/schema.prisma`](prisma/schema.prisma). Para cambiarlo: editar el esquema y correr `npm run prisma:migrate -- --name <descripcion>`, que genera la migración y regenera el cliente.
- Las restricciones que Prisma no expresa, como los `CHECK`, van a mano en el SQL de la migración (ver `migrations/*_add_check_constraints`).
- El seed usa el mismo motor de emparejamiento y la misma calculadora de clasificación que la app, así que los torneos de ejemplo son coherentes con lo que produciría el sistema.

## Pruebas

```bash
npm test
npm run test:coverage
```

Las pruebas no necesitan base de datos ni `.env`: Prisma se simula y [`vitest.setup.ts`](vitest.setup.ts) fija valores de prueba para las variables obligatorias. Hay tres niveles:

- **Dominio puro**: emparejamiento, desempates, estadísticas y documentos (`services/pairing/*.test.ts`, `standings.calculator.test.ts`…).
- **Servicios**: reglas, permisos, estados y atomicidad (`services/**/*.test.ts`).
- **HTTP**: códigos de estado, compuertas de rol y validación, con Supertest (`routes/*.test.ts`).

Las pruebas viven junto al archivo que prueban (`x.ts` → `x.test.ts`).

## Cómo extender

- **Un endpoint nuevo**: esquema zod en `validators/`, caso de uso en `services/` (que lanza `HttpError` para los errores esperados), controlador en `controllers/` que valida con `parseOrThrow` y llama al servicio envuelto en `asyncHandler`, y la ruta en `routes/` con su `requireAuth` / `requireRole`. Si es un recurso nuevo, se monta en [`routes/index.ts`](src/routes/index.ts).
- **Una acción crítica**: su entrada de bitácora se escribe con el mismo cliente transaccional que la acción ([`services/auditLog.service.ts`](src/services/auditLog.service.ts)), para que se confirmen juntas.
- **Un aviso en tiempo real**: el evento se agrega en `sockets/events.ts` y en su copia del frontend, y se emite con `emitToTournament` después de la transacción.
- **Un widget del panel**: clave en `services/dashboard/widgetCatalog.ts`, cargador en `services/dashboard/widgetRegistry.ts` y componente en `frontend/src/components/dashboard/widgetRegistry.ts`. No se tocan rutas ni controladores.
