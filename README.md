# Torre Central Hub

Sistema de gestión de torneos de ajedrez universitarios, desarrollado como Práctica de Ingeniería IV en la Universidad Central (Facultad de Ingeniería y Ciencias Básicas).

Torre Central Hub automatiza el ciclo completo de un torneo de ajedrez universitario: inscripción de jugadores, emparejamiento por sistema suizo adaptado, registro de resultados, cálculo de clasificación y desempates, y cierre oficial del torneo — todo en tiempo real y con trazabilidad administrativa completa.

## Tabla de contenidos

- [Alcance del sistema](#alcance-del-sistema)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Reglas de negocio clave](#reglas-de-negocio-clave)
- [Roadmap](#roadmap)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Puesta en marcha](#puesta-en-marcha)
- [Datos de prueba](#datos-de-prueba)
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

Fuera de alcance (decisión definitiva de producto, no trabajo pendiente): cálculo de rating federativo, exportación en formato TRF, y gestión de sanciones o incidencias arbitrales — estos corresponden a un dominio normativo y disciplinario distinto al de gestión operativa del torneo.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Vue.js |
| Backend | Node.js + Express |
| Tiempo real | Socket.IO |
| Persistencia | PostgreSQL |

## Arquitectura

Arquitectura cliente-servidor: el frontend consume una API REST para operaciones transaccionales (crear torneo, registrar resultado, etc.) y un canal Socket.IO para eventos en tiempo real (`pairing.published`, `match.result.recorded`, `standings.updated`, `player.withdrawn`, `pairing.adjusted`), de modo que emparejamientos y clasificación se actualizan para todos los clientes conectados sin recargar.

## Reglas de negocio clave

- Un jugador no puede inscribirse dos veces en el mismo torneo.
- Una partida no puede repetir un enfrentamiento ya jugado en el torneo, salvo ajuste manual autorizado.
- El orden de desempates se define antes de la primera ronda y solo un administrador puede modificarlo en estado preliminar.
- Solo árbitro u organizador autorizado registran o corrigen resultados.
- Un jugador retirado no recibe nuevos emparejamientos en rondas posteriores.
- Si el número de jugadores activos en una ronda es impar, se asigna bye automático a quien no lo haya recibido antes.
- Todo ajuste manual de emparejamiento y toda acción administrativa crítica quedan registrados en la bitácora de auditoría.

## Roadmap

El desarrollo está planificado en 14 semanas (metodología Scrum adaptada), distribuidas en 2 semanas de levantamiento, 2 de diseño, 9 incrementos funcionales de una semana cada uno, y 1 semana de validación final.

El seguimiento se lleva en este repositorio mediante:

- **[Issues](../../issues)** — una historia de usuario o tarea por issue, organizadas como sub-issues de su Fase/Incremento correspondiente.
- **[Milestones](../../milestones)** — uno por semana, con fecha límite real.
- **[Project](../../projects)** — vista Roadmap con fechas de inicio/fin por actividad.

Esta estructura se genera y actualiza con los scripts de [`tools/github-roadmap/`](./tools/github-roadmap).

## Estructura del proyecto

```
torre-central-hub/
├── backend/                    # API REST (Express + TypeScript) y lógica de negocio
│   ├── prisma/schema.prisma    # Modelo de datos (Prisma + PostgreSQL)
│   ├── src/
│   │   ├── config/             # Variables de entorno y cliente Prisma
│   │   ├── middlewares/        # Manejo de errores, futuros guards de auth
│   │   ├── routes/             # Routers de dominio (montados bajo /api)
│   │   ├── sockets/            # Catálogo de eventos y handlers de Socket.IO
│   │   ├── app.ts              # Configuración de Express
│   │   └── server.ts           # Punto de entrada (HTTP + Socket.IO)
│   └── .env.example
├── frontend/                   # Aplicación Vue 3 + TypeScript (Vite)
│   ├── src/
│   │   ├── router/              # Rutas de la SPA (vue-router)
│   │   ├── stores/               # Estado global (Pinia)
│   │   ├── services/             # Cliente HTTP (axios) y cliente Socket.IO
│   │   └── views/                # Vistas de la aplicación
│   └── .env.example
├── docs/                       # Documento de práctica y diagramas del sistema
├── tools/
│   └── github-roadmap/         # Scripts para sincronizar el roadmap con Issues/Milestones/Project
│       ├── roadmap_github.csv
│       ├── bulk_upload_github.py
│       ├── delete_roadmap_github.py
│       └── README.md
└── README.md
```

> La estructura interna de `backend/` y `frontend/` crecerá con cada incremento; lo anterior es el esqueleto inicial. Ver [`tools/github-roadmap/README.md`](./tools/github-roadmap/README.md) para el detalle de cómo sincronizar el roadmap.

## Puesta en marcha

### Requisitos previos

- Node.js 20+
- PostgreSQL

### Instalación

```bash
git clone https://github.com/hasttyr/torre.git
cd torre

# Backend
cd backend
npm install
cp .env.example .env      # completar DATABASE_URL, JWT_SECRET, etc.
npx prisma migrate dev    # crea la base de datos y aplica el esquema inicial
npm run dev                # http://localhost:4000 (GET /api/health)

# Frontend
cd ../frontend
npm install
cp .env.example .env
npm run dev                # http://localhost:5173
```

## Datos de prueba

`backend/prisma/seed.ts` crea el catálogo de roles y una cuenta de prueba por cada rol, para no tener que registrar manualmente un usuario de cada tipo:

```bash
cd backend
npm run prisma:seed
```

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@test.com | Test1234 |
| Organizador | organizer@test.com | Test1234 |
| Árbitro | arbiter@test.com | Test1234 |
| Entrenador | coach@test.com | Test1234 |
| Jugador | player@test.com | Test1234 |

Además de las cuentas, el seed crea 12 jugadores, clubes, vínculos entrenador–jugador y un historial de competencia real para que los paneles tengan datos: cinco torneos finalizados y uno en curso, con rondas, partidas, resultados y clasificación (puntaje, Buchholz, Buchholz Cortado 1, Sonneborn-Berger) calculada con el mismo `standings.calculator.ts` que usa la app. También asigna a cada rol su panel por defecto (`prisma/seeds/dashboardLayouts.ts`).

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

## Pruebas

```bash
npm test               # en backend/ y en frontend/
npm run test:coverage  # informe de cobertura en coverage/
```

Además de las pruebas unitarias, de servicios y de rutas, `frontend/src/contracts.test.ts` compara los catálogos que frontend y backend duplican (widgets, roles, eventos, resultados…) y falla si se desalinean. La estrategia completa está en [`docs/arquitectura.md`](./docs/arquitectura.md#estrategia-de-pruebas).

## Documentación

La arquitectura interna, las decisiones de diseño y la revisión de septiembre de 2026 están en [`docs/arquitectura.md`](./docs/arquitectura.md).

El documento completo de sustentación (planteamiento del problema, marco referencial, requisitos, casos de uso, modelo de datos, plan de pruebas y trazabilidad completa) está en [`docs/`](./docs).

## Autor

**Nilson Aldair Molina Rengifo**

Universidad Central — Facultad de Ingeniería y Ciencias Básicas

Práctica de Ingeniería IV
