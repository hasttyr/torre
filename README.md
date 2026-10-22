# Torre Central Hub

Sistema de gestión de torneos de ajedrez universitarios, desarrollado como Práctica de Ingeniería IV en la Universidad Central (Facultad de Ingeniería y Ciencias Básicas).

Torre Central Hub automatiza el ciclo completo de un torneo de ajedrez universitario: inscripción de jugadores, emparejamiento por sistema suizo adaptado, registro de resultados, cálculo de clasificación y desempates, y cierre oficial del torneo — todo en tiempo real y con trazabilidad administrativa completa.

## Tabla de contenidos

- [Alcance del sistema](#alcance-del-sistema)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Reglas de negocio clave](#reglas-de-negocio-clave)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Puesta en marcha](#puesta-en-marcha)
- [Datos de prueba](#datos-de-prueba)
- [Ciclo de un torneo](#ciclo-de-un-torneo)
- [Paneles por rol](#paneles-por-rol)
- [Pruebas y calidad](#pruebas-y-calidad)
- [Roadmap](#roadmap)
- [Documentación](#documentación)
- [Autor](#autor)

## Alcance del sistema

El sistema cubre de extremo a extremo:

- Autenticación, roles y permisos (organizador, árbitro, jugador, entrenador, administrador)
- Recuperación de acceso y edición de perfil propio
- Registro de consentimiento y atención de derechos sobre datos personales (Ley 1581 de 2012)
- Creación y configuración de torneos, apertura y cierre de inscripciones
- Gestión de clubes y vinculación de jugadores con entrenadores
- Descubrimiento de torneos disponibles y consulta de torneos administrados
- Emparejamiento suizo adaptado (modelo Dutch, FIDE C.04.1-C.04.3), incluyendo bye automático
- Registro y corrección autorizada de resultados
- Cálculo de clasificación y aplicación de desempates (Buchholz, Buchholz Cortado, Sonneborn-Berger, ARO)
- Publicación de emparejamientos y clasificación en tiempo real
- Retiro de jugadores y ajuste manual de emparejamientos
- Exportación e impresión de clasificación y emparejamientos en PDF
- Bitácora de auditoría de acciones administrativas críticas
- Consulta de historial, estadísticas y finalización del torneo
- Panel de inicio por rol, configurable por el administrador
- Interfaz en español e inglés, con tema claro y oscuro

Fuera de alcance (decisión definitiva de producto, no trabajo pendiente): cálculo de rating federativo, exportación en formato TRF, y gestión de sanciones o incidencias arbitrales — estos corresponden a un dominio normativo y disciplinario distinto al de gestión operativa del torneo.

## Stack tecnológico

| Capa         | Tecnología                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Frontend     | Vue 3 + TypeScript, Vite, Pinia, Pinia Colada (caché de datos del servidor), vue-router, vue-i18n, Tailwind CSS 4, reka-ui |
| Backend      | Node.js + Express 5 + TypeScript, validación con zod, PDF con pdfkit                                                       |
| Tiempo real  | Socket.IO 4                                                                                                                |
| Persistencia | PostgreSQL con Prisma 7 (esquema y migraciones)                                                                            |
| Pruebas      | Vitest (backend y frontend), Supertest, Vue Test Utils                                                                     |

## Arquitectura

Arquitectura cliente-servidor con dos canales:

- **REST** (`/api`) para toda operación que consulta o cambia datos (crear torneo, registrar resultado, etc.).
- **Socket.IO** para avisar en tiempo real que algo cambió en un torneo. Cada torneo tiene su sala, y los eventos son `pairing.published`, `pairing.adjusted`, `match.result.recorded`, `standings.updated`, `player.withdrawn` y `tournament.finished` (detalle en [`backend/README.md`](./backend/README.md#tiempo-real)).

Los eventos solo avisan: el cliente vuelve a pedir los datos por REST, con sus permisos. Así hay una sola fuente de verdad, y emparejamientos, clasificación, retiros y estadísticas se actualizan para todos los clientes conectados sin recargar.

```
Vue 3 SPA ──REST──▶ Express ──▶ servicios de dominio ──▶ Prisma ──▶ PostgreSQL
    ▲                                   │
    └────────── Socket.IO ◀── emitToTournament (tras confirmar la transacción)
```

El detalle de capas está en [`docs/architecture.md`](./docs/architecture.md), y el porqué de cada decisión en [`docs/decisions/`](./docs/decisions/).

## Reglas de negocio clave

- Un jugador no puede inscribirse dos veces en el mismo torneo.
- Una partida no puede repetir un enfrentamiento ya jugado en el torneo, salvo ajuste manual autorizado.
- El orden de desempates se define antes de la primera ronda y solo un administrador puede modificarlo en estado preliminar.
- Solo árbitro u organizador autorizado registran o corrigen resultados.
- Un jugador retirado no recibe nuevos emparejamientos en rondas posteriores.
- Si el número de jugadores activos en una ronda es impar, se asigna bye automático a quien no lo haya recibido antes.
- Todo ajuste manual de emparejamiento y toda acción administrativa crítica quedan registrados en la bitácora de auditoría.

## Estructura del proyecto

```
torre/
├── backend/                  # API REST y tiempo real → backend/README.md
│   ├── prisma/               # Esquema, migraciones y seed de datos de prueba
│   └── src/
│       ├── routes/           # Rutas bajo /api y compuerta de rol
│       ├── controllers/      # Validan la entrada y responden
│       ├── validators/       # Esquemas zod de cada petición
│       ├── services/         # Casos de uso: pairing/, dashboard/, exports/…
│       ├── sockets/          # Salas por torneo y difusión de eventos
│       ├── contracts/        # Contrato de la API (catálogos, errores, respuestas), compartido con el frontend
│       ├── middlewares/      # Autenticación, errores, envoltura async
│       └── config/           # Variables de entorno, cliente Prisma, política de datos
├── frontend/                 # SPA Vue 3 + TypeScript (Vite) → frontend/README.md
│   └── src/
│       ├── views/            # Pantallas por ruta, agrupadas por rol
│       ├── components/       # ui/, charts/, dashboard/, tournament/, home/…
│       ├── queries/          # Datos del servidor en caché (Pinia Colada)
│       ├── stores/           # Estado del cliente (Pinia)
│       ├── services/         # Un módulo por recurso de la API y el cliente Socket.IO
│       ├── lib/              # Composables y utilidades
│       ├── i18n/             # Español (por defecto) e inglés
│       └── router/           # Rutas y guardas de sesión y rol
├── docs/                     # Arquitectura, decisiones (decisions/) y guías paso a paso (runbooks/)
├── .claude/                  # Claude Code: permisos compartidos y comandos del proyecto (skills/)
├── CLAUDE.md                 # Contexto de entrada para Claude Code (hay uno en backend/ y en frontend/)
└── README.md
```

Cada proyecto tiene su propio README con scripts, variables de entorno y convenciones: [`backend/README.md`](./backend/README.md) y [`frontend/README.md`](./frontend/README.md).

## Puesta en marcha

### Requisitos previos

- Node.js 22.12 o superior (Vitest 5 no corre en Node 20)
- PostgreSQL

### Instalación

```bash
git clone https://github.com/hasttyr/torre.git
cd torre

# Backend
cd backend
npm install
cp .env.example .env        # completar DATABASE_URL y JWT_SECRET
npm run prisma:generate     # genera el cliente de Prisma en src/generated/ (no se versiona)
npm run prisma:migrate      # crea la base de datos y aplica las migraciones
npm run prisma:seed         # opcional: cuentas por rol y torneos de ejemplo
npm run dev                 # http://localhost:4000 (GET /api/health)

# Frontend (en otra terminal)
cd frontend
npm install                 # sin .env: los valores por defecto apuntan al backend local
npm run dev                 # http://localhost:5173
```

En desarrollo no hace falta proveedor de correo: al pedir la recuperación de contraseña, el backend escribe el enlace de un solo uso en su consola. En producción se configura `SMTP_URL` (ver [`backend/README.md`](./backend/README.md#variables-de-entorno)).

## Datos de prueba

`backend/prisma/seed.ts` crea el catálogo de roles y una cuenta de prueba por cada rol, para no tener que registrar manualmente un usuario de cada tipo:

```bash
cd backend
npm run prisma:seed
```

| Rol           | Correo             | Contraseña |
| ------------- | ------------------ | ---------- |
| Administrador | admin@test.com     | Test1234   |
| Organizador   | organizer@test.com | Test1234   |
| Árbitro       | arbiter@test.com   | Test1234   |
| Entrenador    | coach@test.com     | Test1234   |
| Jugador       | player@test.com    | Test1234   |

Además de las cuentas, el seed crea 12 jugadores, clubes, vínculos entrenador–jugador y un historial de competencia real para que los paneles tengan datos: cinco torneos finalizados y uno en curso, con rondas, partidas, resultados y clasificación (puntaje, Buchholz, Buchholz Cortado 1, Sonneborn-Berger) calculada con el mismo `standings.calculator.ts` que usa la app. También asigna a cada rol su panel por defecto (`backend/src/services/referenceData.ts`, compartido con `npm run bootstrap`).

El seed es idempotente (`upsert` con `update: {}`): correrlo de nuevo no sobrescribe contraseñas ni datos que hayas modificado a mano mientras pruebas, solo crea lo que falte. Un torneo que ya tiene rondas no se vuelve a jugar, y un rol que ya tiene panel no se reinicia. Son cuentas de solo desarrollo local — no ejecutar contra una base de producción.

## Ciclo de un torneo

1. **Inscripción** (HU04–HU07): el organizador crea y configura el torneo (rondas, ritmo, desempates, valor del bye), abre y cierra inscripciones.
2. **Emparejar** (HU08, HU28): con las inscripciones cerradas, el organizador genera la ronda. El motor suizo adaptado (`backend/src/services/pairing/`) empareja por puntaje, mitad superior contra mitad inferior de cada grupo, sin repetir enfrentamientos (RN-02), equilibrando colores, sin retirados (RN-07) y con bye al jugador de menor puntaje que no lo haya tenido (RN-08). La ronda 1 hace un sorteo que fija el número de emparejamiento de cada jugador.
3. **Revisar y ajustar** (HU29): la ronda queda en borrador, visible solo para quien administra el torneo. Se puede intercambiar a dos jugadores (con motivo obligatorio, RN-09) o descartarla y volver a generarla.
4. **Publicar** (HU09): la ronda se hace visible para todos en la sala del torneo (`/torneos/:id/sala`) y se emite `pairing.published`. Publicar la ronda 1 pasa el torneo a "En curso".
5. **Resultados** (HU10–HU13): cualquier árbitro, el organizador del torneo o un administrador registran y corrigen resultados mesa por mesa (RN-06). Cada cambio recalcula la clasificación completa y la difunde en tiempo real. Las correcciones quedan en la bitácora. La ronda se cierra sola cuando tiene todos sus resultados.
6. **Finalizar** (HU17): con todas las rondas jugadas y registradas, el organizador cierra el torneo; desde entonces no admite cambios.

En la sala del torneo todos ven además sus estadísticas (HU16), y los árbitros y el organizador pueden exportar la clasificación y los emparejamientos de cada ronda en PDF (HU30), con la fecha y hora de generación.

Decisiones de alcance:

- **ARO no se calcula**: necesita el rating de los rivales, y el cálculo de rating está fuera del alcance del proyecto. Si un torneo lo incluye en su orden de desempates, se omite.
- **Resultado particular** sí se aplica como último desempate.
- El **bye** vale 1, ½ o 0 puntos según el torneo (1 por defecto), y ese valor, como el orden de desempates, no se puede cambiar después de generar la ronda 1.
- Si ningún emparejamiento evita repetir un enfrentamiento, la generación se rechaza con un mensaje claro en lugar de repetirlo en silencio.

## Paneles por rol

Cada usuario aterriza en `/panel`, que muestra los controles (widgets) asignados a su rol. El administrador ve todos los controles y decide cuáles ve cada rol, y en qué orden, desde `/panel/configuracion`. La asignación también es un permiso: la API (`GET /api/dashboard/widgets/:key`) rechaza un control que no está en el panel del rol. Cada cambio queda en la bitácora de auditoría. Qué datos ve cada rol lo define una política aparte: un jugador solo ve los suyos y un entrenador solo los de sus jugadores vinculados.

Agregar un control nuevo requiere tres pasos, sin tocar rutas ni controladores: su clave en `backend/src/services/dashboard/widgetCatalog.ts`, su loader en `widgetRegistry.ts` y su componente en `frontend/src/components/dashboard/widgetRegistry.ts`.

## Pruebas y calidad

Cada proyecto se prueba y se revisa por separado, desde su carpeta:

```bash
npm test               # pruebas (Vitest)
npm run test:coverage  # informe de cobertura en coverage/
npm run lint           # ESLint
npm run build          # compila; en frontend incluye el chequeo de tipos (vue-tsc)
npm run test:integration  # backend: contra PostgreSQL real
npm run test:e2e       # frontend: flujos en navegador (Playwright), con la API real
```

Además de las pruebas unitarias, de servicios, de rutas y de componentes, frontend y backend compilan contra el mismo contrato de la API (`backend/src/contracts/`): un campo renombrado o un valor de catálogo que un lado no conoce no compila. La estrategia completa está en [`docs/architecture.md`](./docs/architecture.md#estrategia-de-pruebas), y cómo correr todo como el CI en [`docs/runbooks/validar-ci.md`](./docs/runbooks/validar-ci.md).

## Roadmap

El desarrollo está planificado en 14 semanas (metodología Scrum adaptada), distribuidas en 2 semanas de levantamiento, 2 de diseño, 9 incrementos funcionales de una semana cada uno, y 1 semana de validación final.

El seguimiento se lleva en este repositorio mediante:

- **[Issues](../../issues)** — una historia de usuario o tarea por issue, organizadas como sub-issues de su Fase/Incremento correspondiente.
- **[Milestones](../../milestones)** — uno por semana, con fecha límite real.
- **[Project](../../projects)** — vista Roadmap con fechas de inicio/fin por actividad.

## Documentación

- [`backend/README.md`](./backend/README.md) y [`frontend/README.md`](./frontend/README.md): cómo correr, probar y extender cada proyecto.
- [`docs/architecture.md`](./docs/architecture.md): arquitectura interna y estrategia de pruebas.
- [`docs/decisions/`](./docs/decisions/): el porqué de las decisiones que sostienen el sistema.
- [`docs/runbooks/`](./docs/runbooks/): paso a paso para validar como el CI, crear migraciones, desplegar en Vercel (frontend) y Render (backend) y ejecutar la regresión P01–P33 del plan de pruebas.
- [`CLAUDE.md`](./CLAUDE.md): contexto para trabajar en el proyecto con Claude Code, con sus comandos en `.claude/skills/` (`/validar-ci`, `/nueva-feature`, `/arreglar-bug`, `/revision-seguridad`).

## Autor

**Nilson Aldair Molina Rengifo**

Universidad Central — Facultad de Ingeniería y Ciencias Básicas

Práctica de Ingeniería IV
