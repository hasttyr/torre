# 010. Un torneo se cierra solo al pasar su fecha de fin

Vigente desde noviembre de 2026.

## Contexto

El cierre oficial (HU17) lo hace el organizador, y solo con todas las rondas configuradas jugadas y registradas. Si eso nunca pasa (faltan resultados, nadie generó la última ronda, el organizador se olvidó), el torneo queda "en curso" para siempre: sin ganadores, sin documentos finales y bloqueando las supresiones de datos que esperan a que termine (HU22).

Cerrarlo por la fecha obliga a decidir qué pasa con lo que quedó a medias, y el reglamento del proyecto no cubría partidas sin jugar: el catálogo de resultados (RN-03) solo tenía `1-0`, `½-½`, `0-1` y el `BYE` del emparejador.

## Decisión

- Un torneo `IN_PROGRESS` se cierra solo cuando termina su fecha de fin en Bogotá: `endDate` es un día calendario guardado a medianoche UTC, así que el cierre es `endDate + 1 día + 5 h` (Colombia es UTC-5 todo el año). Un torneo que nunca empezó (sin ronda publicada, así que nunca `IN_PROGRESS`) no se toca.
- Se cierra con lo que hay, como dice FIDE para partidas no jugadas:
  - Una partida publicada sin resultado queda como **doble incomparecencia, `0F-0F`**: 0 puntos para los dos. El sistema no sabe quién faltó, y darle el punto a uno sería inventar un ganador; si el organizador lo sabe, registra `1-0` o `0-1` antes de la fecha.
  - En los desempates cuenta como partida no jugada (como FIDE trata las incomparecencias): no le da rival a ninguno para el Buchholz ni el Sonneborn-Berger. Tampoco es victoria, tablas ni derrota en las estadísticas del panel, ni aparece en el historial de partidas.
  - Una ronda en borrador (nunca publicada) no es oficial (RN-04): se descarta, como `discardRound`.
  - Si se generaron menos rondas que las configuradas, cuentan las que hay.
- El cierre corre al arrancar el servidor y cada 15 minutos mientras está despierto. En el plan gratuito de Render el servicio duerme sin tráfico: la primera visita después de la fecha lo despierta y el torneo se cierra en ese arranque. No hace falta un cron externo ni un secreto nuevo.
- Va a la bitácora (RN-11) como `TOURNAMENT_AUTO_FINISHED`, **sin usuario**: lo hizo el sistema, y la bitácora lo muestra como "Sistema". El detalle dice cuántas partidas quedaron `0F-0F` y cuántos borradores se descartaron.
- Por lo demás es el mismo cierre que el manual: bajo el bloqueo del torneo (decisión 004), completa las supresiones bloqueadas (HU22) y avisa en tiempo real con `tournament.finished` después de confirmar (decisión 003). La sala de un torneo finalizado muestra el podio, y a cada jugador su puesto final.

## Consecuencias

- `results.value` admite `0F-0F` (la restricción `CHECK` cambió) y `audit_logs.user_id` admite `NULL`. Quien lea la bitácora tiene que contar con entradas sin usuario.
- Toda estadística de "partidas jugadas" usa `OFFICIAL_GAME`, que ya deja fuera el `0F-0F`; una consulta nueva que cuente resultados a mano tiene que hacerlo también.
- Una vez cerrado no hay vuelta atrás: como en el cierre manual, el torneo ya no admite cambios. La fecha de fin pasa a importar: un torneo que se alarga hay que extenderlo antes de que venza.

## Dónde está

- `backend/src/services/autoFinish.service.ts` (`finishOverdueTournaments`, `scheduleAutoFinish`), arrancado en `backend/src/server.ts`.
- `backend/src/services/standings.calculator.ts` (`0F-0F` en puntos y desempates), `backend/src/services/dashboard/playerStats.ts` (`OFFICIAL_GAME`).
- `backend/prisma/migrations/*_auto_finish_by_date`.
- `frontend/src/components/tournament/TournamentPodium.vue`.
- Tests: `backend/src/services/autoFinish.int.test.ts`, `autoFinish.service.test.ts`, `standings.calculator.test.ts`.
