# 004. Los cambios a un torneo van bajo bloqueo, con su auditoría

Vigente desde septiembre de 2026.

## Contexto

Dos peticiones al mismo torneo se pueden intercalar: un resultado registrado mientras el torneo finaliza, una inscripción que llega mientras se cierran las inscripciones, dos clics en "Generar ronda". Validar el estado y después escribir, sin bloqueo, deja pasar esos casos. Por otro lado, la bitácora (RN-11) se escribía después de confirmar la acción, así que una acción crítica podía quedar sin auditar.

## Decisión

- Toda escritura sobre un torneo (estado, inscripciones, rondas, resultados) va en una transacción que empieza con `lockTournament(tx, id)`: un `SELECT … FOR UPDATE` sobre la fila del torneo. Las validaciones van **después** del bloqueo, sobre datos que ya nadie más puede cambiar.
- La entrada de la bitácora de una acción crítica se escribe con el mismo cliente transaccional que la acción (`recordAuditLog(tx, …)`): se confirman juntas o ninguna.

## Consecuencias

- Los cambios a un mismo torneo se serializan; entre torneos distintos no hay espera.
- Validar antes del bloqueo es un error aunque parezca funcionar: los tests de carrera lo detectan.
- Las carreras se prueban de forma determinista: la prueba toma el bloqueo, lanza la petición y confirma un cambio mientras ella espera (`raceWithChange`).

## Dónde está

- `backend/src/services/tournamentAccess.ts` (`lockTournament`), `backend/src/services/auditLog.service.ts` (`recordAuditLog`).
- `backend/src/routes/tournaments.int.test.ts` ("concurrent changes to one tournament"), `backend/src/testing/testDatabase.ts` (`raceWithChange`).
