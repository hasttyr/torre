# 003. Los eventos en tiempo real solo avisan

Vigente desde septiembre de 2026.

## Contexto

La sala de un torneo tiene que actualizarse sola cuando se publica una ronda o se registra un resultado. Si los eventos llevaran los datos, habría dos fuentes de verdad, cada evento tendría que respetar los permisos de cada destinatario, y un evento emitido dentro de una transacción que luego se revierte anunciaría algo que nunca pasó.

## Decisión

- Los eventos de Socket.IO solo dicen qué cambió (ids y poco más). El cliente vuelve a pedir por REST lo que necesita, con sus permisos.
- Se emiten con `emitToTournament` **después** de confirmar la transacción, nunca dentro.
- Cada torneo tiene su sala; lo que todavía no es público (un borrador de ronda) va a una sala aparte con quienes administran el torneo (`emitToTournamentManagers`).
- El catálogo de eventos (`SOCKET_EVENTS`) es parte del contrato: el frontend escucha el mismo y refresca la sala con cualquiera de ellos, agrupando ráfagas en un solo refresco.

## Consecuencias

- Una sola fuente de verdad: REST. Un evento perdido se corrige con el siguiente refresco.
- Un evento cuesta una lectura REST por cliente conectado; con el volumen de una universidad no importa.
- Agregar un evento: su entrada en el catálogo y su emisión tras la transacción. El frontend lo escucha sin cambios.

## Dónde está

- `backend/src/sockets/broadcast.ts`, `backend/src/sockets/rooms.ts`, `backend/src/contracts/catalogs.ts` (`SOCKET_EVENTS`).
- `frontend/src/lib/useTournamentLive.ts`.
- `backend/src/sockets/sockets.int.test.ts` (de punta a punta).
