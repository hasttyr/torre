# Ensayo de la UAT: un día de torneo con incidentes

Guion del ensayo previo a la aceptación P35 (#114, #131). La regresión P01–P33 prueba las reglas una por una; este ensayo prueba un día de torneo completo, con lo que suele salir mal. Un guion sin incidentes aprueba sin probar nada.

## Antes del ensayo

- **Ensayo técnico automático.** `frontend/e2e/uatRehearsal.spec.ts` recorre el mismo día con sus incidentes (llegada tarde, autoinscripción, incomparecencia, fecha de fin extendida, "tu mesa"), contra la API real, en cada ejecución del CI. Si está en rojo, no tiene sentido citar a las personas. El 6 de noviembre de 2026 pasó, y en su primera ejecución encontró un error real que ya está corregido: el campo de fecha de fin aparecía vacío.
- **Cuentas del seed, no datos reales.** Mientras la política de datos sea un borrador académico (#129), el ensayo se hace con las cuentas de `backend/prisma/seed.ts` (contraseña `Test1234`), no con datos de estudiantes.
- **Correo.** Si el guion incluye recuperar la contraseña, comprobar antes que producción tenga correo (`despliegue.md`, "Verificar", paso 6). El 6 de noviembre de 2026 no lo tenía (#130): ese paso se omite o se acuerda con el docente cómo se evalúa.

## Quiénes

- **Opera:** un organizador real de la universidad que no sea del equipo, con la cuenta `organizer@test.com`.
- **Arbitra:** el árbitro, con `arbiter@test.com`.
- **Juegan:** 2 o 3 estudiantes que no hayan visto Torre, cada uno desde su celular, con una cuenta de jugador del seed.
- **El equipo solo mira** y lleva el acta. No toca ningún dispositivo ni explica la interfaz; si alguien se traba, se anota y se espera.

## Guion

| #   | Paso                                                                                                                                                                   | Lo que se espera                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | El organizador crea el torneo con una **fecha de fin holgada** (al menos una semana después del ensayo) y 3 rondas, y abre inscripciones                               | El cierre automático por fecha (decisión 010) no puede caer en medio del ensayo   |
| 2   | Un estudiante se inscribe solo, desde _Torneos_                                                                                                                        | Aparece en _Mis inscripciones_ y en la lista del organizador                      |
| 3   | El organizador inscribe al resto y cierra inscripciones                                                                                                                |                                                                                   |
| 4   | **Incidente: llegada tarde.** Llega un estudiante más. El organizador reabre inscripciones, lo inscribe y las cierra                                                   | Sin ronda publicada se puede; si había un borrador, se descarta                   |
| 5   | El organizador genera y publica la ronda 1                                                                                                                             |                                                                                   |
| 6   | **Prueba de pasillo.** Cada estudiante abre la sala en su celular y dice su mesa, su color y su rival                                                                  | Cada uno lo encuentra **en menos de un minuto, sin ayuda** (tarjeta "Tu partida") |
| 7   | **Incidente: incomparecencia.** Uno de los estudiantes "no se presenta". El árbitro registra `1F – 0F` o `0F – 1F`                                                     | El punto va a quien se presentó; los dos pueden volver a cruzarse                 |
| 8   | El árbitro registra el resto de resultados; la sala de los estudiantes se actualiza sola                                                                               |                                                                                   |
| 9   | **Incidente: la jornada se alarga.** El organizador extiende la fecha de fin desde la configuración                                                                    | Queda en la bitácora                                                              |
| 10  | **Incidente: ausencia en una ronda.** Un estudiante avisa que no juega la ronda 2. El organizador decide: retirarlo, o generar la ronda y registrar la incomparecencia |                                                                                   |
| 11  | Rondas 2 y 3. Si el emparejamiento es imposible, el aviso dice cómo seguir; el organizador puede autorizar una revancha con su motivo                                  |                                                                                   |
| 12  | **Incidente: empate en ciclo** (ver abajo)                                                                                                                             | La sala y el PDF muestran el puesto compartido                                    |
| 13  | El organizador descarga la clasificación en PDF y la compara con la sala                                                                                               | Coinciden (P32)                                                                   |
| 14  | El organizador finaliza el torneo                                                                                                                                      | Podio; cada estudiante ve su puesto final                                         |

### Cómo provocar el empate en ciclo

Con un torneo aparte de **3 jugadores y 3 rondas**: cada ronda uno descansa (bye) y los otros dos juegan, así que al final cada uno descansó una vez y jugó contra los otros dos. Registrar los resultados para que **cada uno gane una partida** (A le gana a B, B a C, C a A). Los tres terminan con 2 puntos y los mismos desempates, y el resultado particular es un ciclo: la sala y el PDF deben mostrarlos en un **puesto compartido** (1, 1, 1), con la nota que lo explica.

## Acta

Una fila por paso, con la hora. Lo que más importa: **todo lo que se hizo por fuera del sistema** (una hoja de papel, un mensaje, una explicación del equipo) y por qué.

| Hora | Paso | Quién | ¿Lo hizo sin ayuda? | Hecho por fuera del sistema | Observaciones |
| ---- | ---- | ----- | ------------------- | --------------------------- | ------------- |
|      |      |       |                     |                             |               |

## Regla de decisión

- Una brecha que impida completar el ensayo **sin ayuda técnica** se corrige antes de P35.
- Lo demás va a la Fase 5 como issue, con la fila del acta que lo muestra.
- El resultado de la prueba de pasillo (paso 6) decide la prioridad de lo que falte de "tu mesa".
