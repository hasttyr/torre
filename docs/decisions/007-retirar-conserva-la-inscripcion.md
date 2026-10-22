# 007. Retirar a un jugador conserva su inscripción

Vigente desde septiembre de 2026 (retiro, HU27). Ampliada el 21 de octubre de 2026 (volver a inscribir).

## Contexto

Un jugador retirado ya pudo haber jugado partidas, que siguen contando en el historial, en la clasificación de sus rivales (Buchholz) y en los documentos oficiales. Borrar su inscripción rompería todo eso. Y la base admite una sola inscripción por torneo y jugador (RN-01).

## Decisión

- Retirar marca la inscripción con `withdrawnAt`; no la borra. El retirado sale de la lista activa y de los emparejamientos siguientes (RN-07), y aparece marcado en la clasificación si llegó a jugar.
- Volver a inscribir a un retirado reactiva esa misma fila (`withdrawnAt: null`, y `createdAt` pasa a ser el momento de la nueva inscripción). Solo puede pasar con las inscripciones abiertas, es decir, antes de cualquier ronda, así que no reabre historial de juego.
- Inscribir a alguien que ya está activo sigue siendo `409 ALREADY_ENROLLED`.

## Consecuencias

- Toda consulta del "plantel activo" filtra `withdrawnAt: null`; una que lo olvide cuenta retirados.
- El retiro queda en la bitácora (RN-11); la reinscripción, como cualquier inscripción, no.

## Dónde está

- `backend/src/services/tournaments.service.ts` (`enrollPlayer`, `withdrawPlayer`, `listEnrolledPlayers`), `backend/src/services/rounds.service.ts` (sin retirados al emparejar o publicar).
- `backend/src/routes/tournaments.int.test.ts` ("withdrawing a player").
