# 013. La sala pública muestra solo nombres y cifras deportivas

Vigente desde el 5 de noviembre de 2026 (#140). Amplía la [006](006-busqueda-de-jugadores-del-coach.md) en lo que un desconocido puede ver de un jugador.

## Contexto

La sala, los emparejamientos y la clasificación exigían sesión (HU18). Para proyectar la sala en el lugar del torneo o compartir un enlace con quien no tiene cuenta hacía falta una versión sin sesión. Pero eso pone nombres de estudiantes en internet, donde se pueden copiar, indexar y cruzar con otras fuentes.

## Decisión

- `GET /api/tournaments/public/:id` y la página `/sala-publica/:id` muestran las rondas publicadas y la clasificación sin sesión.
- Solo lo que ya se publica en la pared del torneo: nombres, mesas, resultados, puntos y desempates. Nada de código, programa, semestre, correo, género ni discapacidad, y tampoco los ids de jugadores o partidas: con un id se podría seguir a una persona de un torneo a otro sin pasar por su nombre. La respuesta se arma campo por campo (`select`), así que una columna nueva no se filtra sola.
- Solo torneos que ya publicaron una ronda (`IN_PROGRESS` o `FINISHED`). Antes no hay resultados que mostrar, y la lista de inscritos no es un resultado. Un torneo sin sala responde el mismo 404 que uno que no existe.
- Ninguna ronda en borrador (RN-04).
- `X-Robots-Tag: noindex, nofollow` en la API (`app.ts`) y en la página (`vercel.json`), para que el nombre de un estudiante no aparezca en un buscador. El resto del sitio sigue indexable.
- El mismo límite de peticiones que el listado público, contado entre los dos.
- La página se recarga cada minuto mientras el torneo está en juego, en lugar de usar Socket.IO: el socket pide un ticket de sesión, y abrirlo a cualquiera sería otra superficie.
- La política de datos (sección "Quién ve qué") lo dice.

## Consecuencias

- Quien juega un torneo aparece con su nombre en una página pública desde la primera ronda publicada, sin poder ocultarse. Es lo mismo que pasa con la hoja impresa en el lugar del torneo. Si la universidad pide que sea opcional, el camino es una casilla por torneo que active la sala, con su entrada en la bitácora.
- `noindex` es un pedido que los buscadores serios respetan, no un candado: quien tenga el enlace puede copiar la página.
- `PairingsTable` y `StandingsTable` aceptan filas sin id, porque la sala pública no los recibe.

## Dónde está

- `backend/src/services/publicRoom.service.ts`, `backend/src/contracts/responses.ts` (`PublicRoomDto`), `backend/src/app.ts` (`noIndex`), `backend/src/middlewares/rateLimits.ts` (`publicListing`).
- `frontend/src/views/PublicRoomView.vue`, `frontend/src/views/PublicTournamentsView.vue`, `frontend/vercel.json`.
- Tests: `backend/src/routes/publicRoom.int.test.ts` (lo que no puede salir), `publicTournaments.routes.test.ts` (el límite), `frontend/src/views/PublicRoomView.test.ts`, `frontend/src/deployment.test.ts`, `frontend/e2e/publicTournaments.spec.ts`.
