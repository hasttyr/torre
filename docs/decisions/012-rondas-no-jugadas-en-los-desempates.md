# 012. Una ronda no jugada cuenta en los desempates contra un rival ficticio

Vigente desde el 5 de noviembre de 2026 (#139). Reemplaza lo que decían la [010](010-cierre-automatico-por-fecha.md) y la [011](011-incomparecencias.md) sobre los desempates: que una incomparecencia "no le da rival a ninguno".

## Contexto

El bye y las incomparecencias sumaban sus puntos al puntaje, pero no le daban rival a nadie para el Buchholz ni el Sonneborn-Berger: aportaban cero. Con un número impar de jugadores eso decide puestos: en un caso de 5 jugadores, quienes tuvieron bye quedaron detrás entre los empatados a 2 puntos, solo por haberlo tenido. FIDE no lo trata así.

La referencia es el reglamento de desempates de FIDE vigente (C.07, Play-Off and Tie-Break Regulations, aplicado desde el 1 de marzo de 2026), artículo 16, "Unplayed Rounds Management".

## Decisión

Para los desempates de un torneo suizo, cada ronda no jugada (el bye que asigna el emparejamiento y las incomparecencias `1F-0F`, `0F-1F` y `0F-0F`) cuenta así:

- **En los desempates propios** (16.4): como una partida contra un rival ficticio cuyo puntaje es el del propio jugador, con el resultado que dio la ronda (el valor del bye, 1 o 0 de la incomparecencia). Ese puntaje tiene dos topes: los puntos de unas tablas por el número de rondas del torneo (16.4.2), y, en una incomparecencia, el puntaje del rival que no jugó (16.4.1). Suma al Buchholz y, multiplicado por el resultado, al Sonneborn-Berger.
- **En los desempates de los rivales** (16.3): el puntaje de un jugador cuenta tal como es, con los puntos de sus rondas no jugadas.
- **Buchholz Cortado 1** (16.5): si el jugador perdió alguna ronda por incomparecencia (una "ronda no jugada voluntaria"), se le quita la menor de esas en lugar del rival más débil.
- El resultado particular y RN-02 no cambian: una ronda no jugada no es un enfrentamiento (decisión 011).

## Consecuencias

- Quien tuvo bye ya no queda detrás en el Buchholz por eso, y una incomparecencia ya no le baja los desempates a quien se presentó.
- El cálculo necesita el número de rondas del torneo para el tope (`recalculateStandings` lo pasa); sin él, el rival ficticio no tiene ese tope.
- **No se aplica a los retiros.** FIDE cuenta cada ronda después de un retiro como un bye de cero puntos (16.1.1) y, para los rivales, como tablas (16.3.2). El sistema no guarda en qué ronda se retiró alguien ni crea partidas para las rondas que no jugó, así que un retirado solo cuenta con las partidas que tiene. Queda como desviación conocida.
- Los torneos ya cerrados no se recalculan solos: su clasificación cambia la próxima vez que algo la recalcule (una corrección de resultado), y un torneo finalizado ya no admite cambios. Si hiciera falta, se recalculan a mano.

## Dónde está

- `backend/src/services/standings.calculator.ts` (`computeStandings`, `cutOne`), llamado desde `standings.service.ts` con el número de rondas.
- Tests: `standings.calculator.test.ts` ("an unplayed round", con el caso de 5 jugadores), `standings.service.test.ts`.
