# 011. Una incomparecencia suma sus puntos, pero no es una partida jugada

Vigente desde el 6 de noviembre de 2026 (#136). Amplía la [010](010-cierre-automatico-por-fecha.md), que trajo el `0F-0F` solo para el cierre automático.

## Contexto

El catálogo de resultados (RN-03) solo tenía `1-0`, `½-½` y `0-1`. Cuando un jugador no se presentaba, el árbitro anotaba `1-0` o `0-1`, y el sistema lo trataba como una partida jugada: el ganador sumaba al Buchholz y al Sonneborn-Berger del rival ausente, y los dos ya no podían volver a cruzarse (RN-02), aunque nunca se sentaron frente a frente.

## Decisión

- Quien registra resultados (RN-06) puede anotar las incomparecencias de FIDE: `1F-0F` (no se presentaron las negras), `0F-1F` (no se presentaron las blancas) y `0F-0F` (ninguno). El `0F-0F` sigue siendo también lo que pone el cierre automático.
- Suman sus puntos al puntaje: 1 a quien se presentó, 0 a quien no.
- Para todo lo demás son partidas no jugadas, como FIDE trata las incomparecencias:
  - no le dan rival a ninguno para el Buchholz ni el Sonneborn-Berger, ni cuentan como resultado particular;
  - no cuentan para RN-02: los dos pueden emparejarse en una ronda siguiente;
  - no cuentan para la alternancia de colores;
  - no son victoria, tablas ni derrota en las estadísticas, ni aparecen en el historial de partidas.
- Catálogo cerrado, sin un motivo escrito: el motivo de una ausencia invita a anotar datos de salud, que la Ley 1581 (art. 5) trata como sensibles. Una corrección (HU11) sigue pidiendo su motivo opcional, como cualquier otra.

## Consecuencias

- La restricción `CHECK` de `results.value` admite `1F-0F` y `0F-1F` (migración `20261106000000_forfeits`).
- Toda consulta o cálculo de "partidas jugadas" pregunta por `isForfeit` o `FORFEIT_RESULTS` (`contracts/catalogs.ts`), no por `0F-0F` solo; `OFFICIAL_GAME` (`dashboard/playerStats.ts`) ya lo hace.
- En la sala y en el PDF se muestran con la notación de FIDE (`1F – 0F`), y la sala explica cada una al pasar el puntero.

## Dónde está

- `backend/src/contracts/catalogs.ts` (`FORFEIT_RESULTS`, `isForfeit`), `backend/src/services/standings.calculator.ts`, `backend/src/services/pairing/pairingHistory.ts`, `backend/src/services/dashboard/playerStats.ts`.
- `frontend/src/components/tournament/ResultPicker.vue`, `PairingsTable.vue`, `frontend/src/lib/format.ts`.
- Tests: `standings.calculator.test.ts`, `pairingHistory.test.ts`, `routes/tournaments.int.test.ts` ("a forfeit"), `autoFinish.int.test.ts` (la restricción), `ResultPicker.test.ts`.
