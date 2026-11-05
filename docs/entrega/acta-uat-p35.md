# Acta de aceptación del usuario (P35)

Aceptación formal del sistema por los actores del torneo (#114). Se llena el día de la UAT, después del ensayo (`docs/runbooks/ensayo-uat.md`), y la firma el organizador.

## Datos de la sesión

| Campo                 | Valor                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Fecha y hora          |                                                                                                                              |
| Lugar                 |                                                                                                                              |
| Ambiente              | `https://torre-roan.vercel.app`                                                                                              |
| Commit evaluado       | (el de la entrega, ver `entrega.md`)                                                                                         |
| Organizador           |                                                                                                                              |
| Árbitro               |                                                                                                                              |
| Jugadores (cuántos)   |                                                                                                                              |
| Equipo (solo observa) |                                                                                                                              |
| Cuentas usadas        | Del seed (`backend/prisma/seed.ts`), no datos reales de estudiantes, mientras la política de datos sea un borrador académico |

## Criterios de aceptación

Cada uno se marca **Cumple**, **No cumple** u **Omitido** (con el motivo).

| #   | Criterio                                                                                | Actor         | Resultado | Observaciones                                                                                                 |
| --- | --------------------------------------------------------------------------------------- | ------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Crea y configura el torneo (rondas, ritmo, desempates, bye, elegibilidad, fecha de fin) | Organizador   |           |                                                                                                               |
| 2   | Abre, cierra y, ante una llegada tarde, reabre inscripciones                            | Organizador   |           |                                                                                                               |
| 3   | Un jugador se inscribe solo; el organizador inscribe al resto                           | Jugador, org. |           |                                                                                                               |
| 4   | Genera, revisa y publica una ronda; ajusta un emparejamiento con su motivo              | Organizador   |           |                                                                                                               |
| 5   | Cada jugador encuentra su mesa, color y rival en menos de un minuto, sin ayuda          | Jugadores     |           |                                                                                                               |
| 6   | Registra resultados e incomparecencias desde el celular; la sala se actualiza sola      | Árbitro       |           |                                                                                                               |
| 7   | Corrige un resultado con su motivo                                                      | Árbitro       |           |                                                                                                               |
| 8   | La clasificación aplica los desempates y muestra el puesto compartido si no se resuelve | Todos         |           |                                                                                                               |
| 9   | El PDF oficial coincide con la sala                                                     | Organizador   |           |                                                                                                               |
| 10  | Finaliza el torneo; el podio y el puesto de cada jugador se ven                         | Todos         |           |                                                                                                               |
| 11  | Un jugador descarga sus datos desde su cuenta (Ley 1581)                                | Jugador       |           |                                                                                                               |
| 12  | Recupera el acceso con el enlace por correo                                             | Jugador       |           | Requiere correo en producción (#130). Si no está, se marca Omitido y se acuerda con el docente cómo se evalúa |

## Hallazgos

| #   | Paso | Qué pasó | Severidad (crítico, alto, medio, bajo) | ¿Bloquea la aceptación? |
| --- | ---- | -------- | -------------------------------------- | ----------------------- |
|     |      |          |                                        |                         |

Una brecha que impidió completar un criterio sin ayuda técnica se corrige antes de firmar. Lo demás queda como issue de la Fase 5.

## Decisión

- [ ] **Aceptado**
- [ ] **Aceptado con observaciones** (las de la tabla de hallazgos, sin fallos críticos)
- [ ] **No aceptado** (motivo):

| Rol         | Nombre | Firma | Fecha |
| ----------- | ------ | ----- | ----- |
| Organizador |        |       |       |
| Árbitro     |        |       |       |
| Docente     |        |       |       |
