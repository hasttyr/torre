# 014. El motor suizo se queda simplificado

Vigente desde el 5 de noviembre de 2026 (#142, cerrado sin implementar).

## Contexto

El motor de emparejamiento (`services/pairing/swissPairing.ts`) es un Dutch de FIDE (C.04.3) adaptado y simplificado:

- ordena por puntaje y número de sorteo, sin rating;
- asigna los colores después de decidir las parejas, así que no garantiza los criterios absolutos de color de FIDE: nadie con el mismo color tres veces seguidas, ni con más de dos partidas de diferencia entre blancas y negras;
- resuelve los grupos de puntaje con búsqueda hacia atrás, no con el orden completo de criterios de C.04.3.

El #142 proponía acercarlo a C.04.3, con una condición previa: mostrar con torneos reales que la simplificación cambió algún emparejamiento o algún puesto.

## Decisión

No se completa. El código queda congelado con la entrega (`docs/entrega/entrega.md`), y este cambio no lo justifica:

- **No hay evidencia de que haga falta.** Ningún torneo jugado mostró un emparejamiento distinto por la simplificación. La condición del #142 no se cumplió.
- **No llegaría a ser FIDE.** C.04.3 ordena por rating, y los torneos universitarios no lo tienen. Un motor "FIDE" solo lo es con el aval de FIDE (C.04.A), que motores como JaVaFo o bbpPairings tienen y uno propio no.
- **Es la parte más delicada del sistema.** Pasó la regresión y el ensayo técnico de la UAT. Reescribirla al cierre arriesga lo que funciona a cambio de una conformidad que igual no se alcanzaría.
- **El árbitro lo acepta si se anuncia.** Basta con que las bases del torneo digan que el emparejamiento es un suizo simplificado. El guion del ensayo y el acta de la UAT lo piden antes de empezar.

## Consecuencias

- Las bases de cada torneo tienen que anunciar el motor simplificado. Es una condición del árbitro, no una preferencia.
- Si un torneo real muestra una diferencia que importe, se abre un issue nuevo con el caso concreto. Lo más barato de arreglar sería solo los criterios absolutos de color, sin tocar cómo se forman las parejas. Para encontrar el caso, se compara el torneo con un motor avalado (exportarlo en TRF y emparejarlo con bbpPairings).

## Dónde está

- `backend/src/services/pairing/swissPairing.ts` (el comentario de cabecera lista la simplificación).
- `docs/runbooks/regresion.md` ("Ajustes respecto del documento"), `docs/runbooks/ensayo-uat.md` ("Antes del ensayo"), `docs/entrega/acta-uat-p35.md`.
