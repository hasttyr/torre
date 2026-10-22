# 005. La bitácora no guarda nombres

Vigente desde septiembre de 2026. Ampliada en octubre de 2026 (el texto escrito por alguien tampoco puede nombrar).

## Contexto

La Ley 1581 da derecho a suprimir los datos personales (HU22). Si la bitácora guardara "Luis Gómez retiró a Ana Torres", una supresión dejaría el nombre ahí para siempre. Y si se guardara el texto que alguien escribió tal cual (un motivo de retiro, el nombre de un torneo), quien escribiera `{{user:<id>}}` haría aparecer el nombre de esa persona en la bitácora del administrador.

## Decisión

- A una persona se la nombra con `mention(userId)`: la entrada guarda una referencia, y el nombre se pone al leer la bitácora. Si esa persona suprime sus datos, la bitácora muestra "Usuario eliminado".
- Todo texto que escribió alguien pasa por `plain()`, que no puede formar una mención. Solo `mention()` nombra a alguien.
- Las entradas anteriores a esta decisión, que guardaban nombres como texto, se migran con `npm run audit:link-names`.

## Consecuencias

- La bitácora se lee igual que antes, y una supresión también la anonimiza.
- Una acción crítica nueva tiene que construir su texto con `mention()` y `plain()`; concatenar un nombre o un texto del usuario es un error.

## Dónde está

- `backend/src/services/auditLog.service.ts` (`mention`, `plain`, `recordAuditLog`).
- `backend/src/scripts/migrateLegacyAuditDetails.ts` y su `.int.test.ts`.
