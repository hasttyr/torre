# Backend

API REST y Socket.IO. Cómo correrlo, variables de entorno, la tabla de endpoints y "Cómo extender": [`README.md`](README.md). Aquí, lo que conviene tener presente al cambiar código.

## Por dónde pasa una petición

`routes/` (ruta y compuerta gruesa de rol) → `controllers/` (`parseOrThrow` con el esquema zod de `validators/`) → `services/` (reglas, permisos finos, transacción, auditoría) → Prisma. Después de confirmar, `emitToTournament` avisa por Socket.IO.

- Los servicios reciben el cliente de Prisma como parámetro: se prueban con un Prisma simulado y comparten transacción cuando hace falta.
- Un error esperado es `throw new HttpError("CODIGO", params)` (`src/errors/apiErrors.ts`). Un código nuevo va en `src/contracts/errors.ts`, con su estado y mensaje en español, y en `apiErrors` de `frontend/src/i18n/locales/{es,en}.json`. `contracts.test.ts` del frontend falla si falta la traducción.
- Lo que la API responde se tipa en `src/contracts/responses.ts`. `src/contracts/` no importa nada de fuera de ella: la compila también el frontend.
- El cálculo puro (`services/pairing/`, `standings.calculator.ts`, `exports/`) no toca la base.

## Reglas que el código no grita

- **Un cambio a un torneo** va en una transacción que empieza con `lockTournament(tx, id)`, y las validaciones van después del bloqueo (`docs/decisions/004-cambios-a-un-torneo-bajo-bloqueo.md`).
- **Una acción crítica** (RN-11) escribe su entrada con `recordAuditLog(tx, …)` en la misma transacción. A una persona se la nombra con `mention(userId)`, y el texto que escribió alguien pasa por `plain()` (`docs/decisions/005-la-bitacora-no-guarda-nombres.md`).
- **Quién puede qué** en un torneo está en `services/tournamentAccess.ts`; de qué jugadores puede ver datos cada rol, en `services/dashboard/scopes.ts`. No repetir esas reglas en otro servicio.
- **Datos personales**: un resultado nunca lleva el correo; una cuenta bloqueada o suprimida (`status !== "ACTIVE"`) no se puede inscribir, vincular ni asignar. Retirar a un jugador conserva su inscripción (`docs/decisions/007-retirar-conserva-la-inscripcion.md`).
- **Campos de texto**: usar los de `validators/fields.ts`, que ya traen su longitud máxima.
- **Migraciones**: lo que Prisma no expresa (`CHECK`, extensiones, cambios de tipo con datos) se escribe a mano en el SQL de la migración. Pasos en `docs/runbooks/migraciones.md`.
- **SQL crudo**: solo con `$queryRaw` y plantilla (los valores van como parámetros, nunca concatenados). En la plantilla, una expresión regular con `\` se escribe con clases POSIX (`[[:space:]]`): el `\` se pierde en el literal de JavaScript.

## Tests

- `npm test`: unitarias, con Prisma simulado y sin base de datos. Los mocks de Prisma se arman por archivo (`buildPrismaMock` en `services/tournaments.service.test.ts`); si el servicio empieza a usar un método nuevo (`enrollment.update`), hay que agregarlo al mock.
- `npm run test:integration` (`*.int.test.ts`): contra PostgreSQL real. Aquí va lo que solo la base puede probar: SQL crudo, restricciones, transacciones, carreras (`raceWithChange`), Socket.IO de punta a punta. Helpers en `src/testing/testDatabase.ts` (`createUser`, `createTournament`, `bearer`, `resetDatabase`).
- `npm run test:coverage`: las dos suites, con los umbrales de `vitest.config.mts`.
