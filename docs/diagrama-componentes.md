# Diagrama de componentes — Torre Central Hub

El diagrama de componentes de S4 ya existe en el documento de sustentación: [`docs/media/image10.png`](./media/image10.png) ("Componentes de arquitectura"). Este archivo no lo reemplaza — lo traduce a la estructura de carpetas real del código, para que ambos se lean juntos.

![Componentes de arquitectura](./media/image10.png)

## Correspondencia entre el diagrama y el código

| Módulo del diagrama | Ubicación en el código | Responsabilidad |
|---|---|---|
| Vue.js SPA | `frontend/src/views`, `frontend/src/router`, `frontend/src/stores` | Pantallas por rol, navegación y estado (Pinia) |
| — (cliente HTTP/WS) | `frontend/src/services/api.ts`, `frontend/src/services/socket.ts` | Cliente axios hacia la API REST y cliente socket.io hacia el gateway |
| Node.js + Express API | `backend/src/app.ts`, `backend/src/routes` | Enrutamiento REST bajo `/api` |
| Socket.IO Gateway | `backend/src/sockets` | Emisión del catálogo de eventos en tiempo real |
| Modulo Auth y Roles | *(a codificar en S5 — Incremento 1)* | HU01-03: registro, autenticación, roles y permisos |
| Modulo Emparejamiento | *(a codificar en S7 — Incremento 3)* | HU08-09: generación y publicación de emparejamiento suizo |
| Modulo Resultados y Clasificación | *(a codificar en S8 — Incremento 4)* | HU10-13: registro de resultados, recálculo de clasificación y desempates |
| PostgreSQL | `backend/prisma/schema.prisma` | Persistencia según el modelo ER de S4 (ver más abajo) |

## Modelo ER (S4)

El modelo ER conceptual y el diagrama de clases de dominio ya están en el documento de sustentación:

- [`docs/media/image1.png`](./media/image1.png) — ER conceptual
- [`docs/media/image7.png`](./media/image7.png) — Clases de dominio
- [`docs/media/image8.png`](./media/image8.png) — Estados de torneo/ronda y ciclo de partida

`backend/prisma/schema.prisma` codifica ese modelo para PostgreSQL, con las 9 entidades del Objetivo específico 3 (Usuario, Rol, Jugador, Torneo, Ronda, Partida, Resultado, CriterioDesempate, Clasificacion). Dos decisiones de traducción de diagrama conceptual a esquema físico, documentadas también como comentarios en el propio `schema.prisma`:

- Los campos `estado` (tipados como `string` genérico en los diagramas) se refinan a enums de PostgreSQL (`EstadoUsuario`, `EstadoTorneo`, `EstadoRonda`, `EstadoPartida`) con los mismos valores mostrados en `image8.png`, para integridad a nivel de base de datos.
- `Resultado` es una entidad 1:1 con `Partida` (relación "registra" del ER conceptual), no un catálogo compartido: cada partida decidida tiene su propia fila con la fecha de registro. El catálogo de valores válidos (RN-03) se aplica con un `CHECK` en la migración.

Entidades como Club, Federación, EntrenadorJugador, Bitácora e Inscripción no están en el alcance de S4 (no aparecen en el ER conceptual ni en el diagrama de clases): pertenecen a incrementos posteriores del roadmap (S10-S13) y se agregan al esquema cuando se codifique esa semana.

La migración inicial está en `backend/prisma/migrations/20260904000000_init/`, generada sin necesitar una base de datos activa (`prisma migrate diff --from-empty`); se aplica con `npx prisma migrate dev` en cuanto haya un PostgreSQL disponible.
