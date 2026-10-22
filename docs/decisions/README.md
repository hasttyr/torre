# Decisiones

Por qué el sistema es como es. Cada archivo cuenta una decisión: el problema, lo que se eligió, lo que cuesta y dónde vive en el código. Antes de cambiar algo que parece raro o demasiado estricto, conviene buscar aquí: muchas veces es a propósito.

| #   | Decisión                                                                                              | Desde      |
| --- | ----------------------------------------------------------------------------------------------------- | ---------- |
| 001 | [El contrato de la API se comparte, no se copia](001-contrato-compartido.md)                          | sept. 2026 |
| 002 | [La sesión es una cookie que ningún script lee](002-sesion-en-cookie-httponly.md)                     | sept. 2026 |
| 003 | [Los eventos en tiempo real solo avisan](003-los-eventos-solo-avisan.md)                              | sept. 2026 |
| 004 | [Los cambios a un torneo van bajo bloqueo, con su auditoría](004-cambios-a-un-torneo-bajo-bloqueo.md) | sept. 2026 |
| 005 | [La bitácora no guarda nombres](005-la-bitacora-no-guarda-nombres.md)                                 | sept. 2026 |
| 006 | [La búsqueda de jugadores del coach](006-busqueda-de-jugadores-del-coach.md)                          | oct. 2026  |
| 007 | [Retirar a un jugador conserva su inscripción](007-retirar-conserva-la-inscripcion.md)                | oct. 2026  |
| 008 | [La cobertura solo sube](008-la-cobertura-solo-sube.md)                                               | sept. 2026 |
| 009 | [Los datos del servidor viven en Pinia Colada](009-datos-del-servidor-en-pinia-colada.md)             | sept. 2026 |

## Cómo agregar una

Un archivo `NNN-titulo-en-minusculas.md` con el siguiente número, y su fila en esta tabla:

```markdown
# NNN. Título

Vigente desde <fecha>. <Reemplaza a / la reemplaza NNN, si aplica.>

## Contexto

El problema y lo que lo hacía difícil.

## Decisión

Lo que se eligió, en concreto.

## Consecuencias

Lo que se gana, lo que cuesta y lo que obliga a hacer.

## Dónde está

Archivos y tests que la sostienen.
```

Una decisión que cambia no se borra: se marca como reemplazada y se escribe la nueva.
