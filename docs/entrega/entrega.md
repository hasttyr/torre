# Entrega final

Lo que se entrega de Torre Central Hub al cierre de la Fase 4 (#115), cómo evaluarlo y qué queda pendiente fuera del código. A partir de esta entrega el código queda congelado: solo entran correcciones de fallos que bloqueen la aceptación (P35).

## Qué se entrega

| Pieza           | Dónde                                                                                                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aplicación      | `https://torre-roan.vercel.app` (Vercel)                                                                                                                                                                                                                 |
| API             | `https://torre-be.onrender.com` (Render, con su PostgreSQL)                                                                                                                                                                                              |
| Código          | `main` de este repositorio; los dos despliegan solos desde ahí                                                                                                                                                                                           |
| Commit validado | El último de `main` con el CI en verde. La regresión manual (`docs/runbooks/regresion.md`, "Ejecución del 5 de noviembre de 2026") se hizo antes de la sala pública (#140) y los avisos de ronda (#141); sus casos automáticos se repiten en cada commit |

Para evaluar, las cuentas de demostración del seed (contraseña `Test1234`): `admin@test.com`, `organizer@test.com`, `arbiter@test.com`, `coach@test.com` y `player@test.com`, más los jugadores del historial (README, "Datos de prueba"). Producción tiene cargados esos datos de demostración, no datos de estudiantes reales.

En el plan gratuito de Render la API duerme sin tráfico: la primera visita tarda alrededor de un minuto en despertarla.

## Cómo se verificó

- **Regresión P01–P33** (#113): todos los casos con su test en verde en el CI, el PDF comparado con la sala (P32) y el ambiente revisado contra `docs/runbooks/despliegue.md`. Resultado: cero regresiones funcionales. Detalle en `docs/runbooks/regresion.md`.
- **Sala pública y avisos de ronda** (#140, #141): lo que la sala pública no puede mostrar y a quién le llega el aviso se prueba contra la base real (`publicRoom.int.test.ts`, `roundNotices.int.test.ts`); la sala, también de punta a punta (`frontend/e2e/publicTournaments.spec.ts`).
- **Ensayo técnico de la UAT** (#131): `frontend/e2e/uatRehearsal.spec.ts` recorre un día de torneo con sus incidentes en cada ejecución del CI.
- **Compuertas del CI** (`.github/workflows/ci.yml`): lint, tipos, formato, pruebas con umbrales de cobertura, build, auditoría de dependencias y e2e, en cada commit de `main`.

## Documentación

| Para                                | Documento                                                      |
| ----------------------------------- | -------------------------------------------------------------- |
| Qué hace el sistema y cómo correrlo | `README.md`, `backend/README.md`, `frontend/README.md`         |
| Cómo está construido                | `docs/architecture.md`                                         |
| Por qué es como es                  | `docs/decisions/` (001–013)                                    |
| Operarlo                            | `docs/runbooks/` (validar como el CI, migraciones, despliegue) |
| Probarlo                            | `docs/runbooks/regresion.md`, `docs/runbooks/ensayo-uat.md`    |
| Aceptarlo                           | `docs/entrega/acta-uat-p35.md`                                 |

## Desviaciones respecto del documento de sustentación

Están, cada una con su porqué, en `docs/runbooks/regresion.md` ("Ajustes respecto del documento"). Las que siguen abiertas:

- **P13:** ARO no se calcula; necesita ratings, fuera del alcance.
- **P16, P26 y P27:** son ajustes a propósito: estadísticas visibles con sesión, consentimiento del jugador para el entrenador e inscripción solo con estado abierto.
- **Retiros en los desempates:** no siguen el art. 16.1.1 de FIDE (decisión 012).
- **RN-10:** la política de datos es un borrador académico hasta que la universidad entregue la oficial.

## Pendiente fuera del código

| Qué                                                     | Issue | Quién lo resuelve                                                                                          |
| ------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------- |
| Aceptación P35 con los actores del torneo               | #114  | Organizador, árbitro y estudiantes, con el acta `acta-uat-p35.md`                                          |
| Ensayo de la UAT con personas                           | #131  | Un organizador de la universidad que no sea del equipo, con `ensayo-uat.md`                                |
| Correo para recuperar la contraseña y avisar las rondas | #130  | Quien administre Render: una cuenta SMTP y las variables `SMTP_URL` y `MAIL_FROM`                          |
| Texto oficial de la política de datos                   | #129  | La universidad o un profesional en protección de datos; después, reemplazar el borrador y subir la versión |

## Después de la entrega (Fase 5)

La sala pública de solo lectura (#140) quedó hecha, con el borrador de la política de datos ([decisión 013](../decisions/013-sala-publica.md)): cuando llegue la política oficial, tiene que decir lo mismo sobre quién ve los nombres. El aviso por correo al publicarse una ronda (#141) también quedó hecho: sale en cuanto producción tenga correo (#130), y mientras no lo tenga, la cuenta del jugador dice que no se están enviando. Queda abierto, con su condición, un motor suizo más cercano a FIDE C.04.3 (#142), que antes pide mostrar con torneos reales que la simplificación cambió algún emparejamiento.
