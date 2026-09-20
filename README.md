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

El seed es idempotente (`upsert` con `update: {}`): correrlo de nuevo no sobrescribe contraseñas ni datos que hayas modificado a mano mientras pruebas, solo crea lo que falte. Son cuentas de solo desarrollo local — no ejecutar contra una base de producción.

## Documentación

El documento completo de sustentación (planteamiento del problema, marco referencial, requisitos, casos de uso, modelo de datos, plan de pruebas y trazabilidad completa) está en [`docs/`](./docs).

## Autor

**Nilson Aldair Molina Rengifo**

Universidad Central — Facultad de Ingeniería y Ciencias Básicas

Práctica de Ingeniería IV
