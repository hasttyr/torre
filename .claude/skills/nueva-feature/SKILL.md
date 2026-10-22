---
name: nueva-feature
description: Usar cuando se va a agregar o cambiar comportamiento en torre, del lado que sea: un endpoint, un campo, una pantalla, una regla de negocio (HU/RN), un widget del panel, un evento en tiempo real o un texto de la interfaz.
---

# Nueva feature en torre

Una feature atraviesa varias capas, y olvidar una no siempre rompe la compilación: una traducción en un solo idioma, un evento que nadie emite, un permiso que solo revisa el frontend. Esta es la lista de capas y en qué orden recorrerlas.

## Antes de escribir código

- Ubicar la HU/RN que la origina y buscar en `docs/decisions/` lo que toca. Si la feature contradice una decisión (por ejemplo, ampliar la búsqueda del coach), preguntar antes de seguir.
- Decidir quién puede hacerla y qué datos personales ve cada rol. Si toca personas, leer también la skill `revision-seguridad`.

## Capas, de adentro hacia afuera

| #   | Capa       | Qué hacer                                                                                                                                                                                                                            |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Contrato   | Tipos de respuesta en `contracts/responses.ts`, valores nuevos en `contracts/catalogs.ts`, códigos de error en `contracts/errors.ts`                                                                                                 |
| 2   | Base       | Esquema y migración (`docs/runbooks/migraciones.md`)                                                                                                                                                                                 |
| 3   | Validación | Esquema zod en `validators/`, con los campos de `validators/fields.ts`                                                                                                                                                               |
| 4   | Servicio   | Permisos con `tournamentAccess.ts` / `dashboard/scopes.ts`; cambio a un torneo bajo `lockTournament`; acción crítica con `recordAuditLog` + `mention()`/`plain()`; `HttpError("CODIGO")`; emitir el evento después de la transacción |
| 5   | HTTP       | Controlador con `parseOrThrow`; ruta con `requireAuth`/`requireRole`; montar un recurso nuevo en `routes/index.ts`                                                                                                                   |
| 6   | Cliente    | Función en `frontend/src/services/` y su fila en `services/http.test.ts`; lectura en `queries/`                                                                                                                                      |
| 7   | Pantalla   | Vista y ruta (`router/index.ts` con `meta.roles`); tokens de `style.css`; `useConfirm`, `LoadError`, `useQueryParam` según haga falta                                                                                                |
| 8   | Textos     | Cada clave en `es.json` **y** `en.json`; un código de error nuevo también en `apiErrors`                                                                                                                                             |
| 9   | Tests      | Servicio (Prisma simulado), ruta (Supertest), integración si hay SQL/transacción/carrera, vista; e2e si cruza roles                                                                                                                  |
| 10  | Docs       | Tabla de la API en `backend/README.md`, rutas en `frontend/README.md`; una decisión nueva si se eligió algo no obvio                                                                                                                 |

Un widget del panel no pasa por rutas ni controladores: clave en `services/dashboard/widgetCatalog.ts`, cargador en `services/dashboard/widgetRegistry.ts` y componente en `frontend/src/components/dashboard/widgetRegistry.ts`.

## Cerrar

1. Un commit por cambio lógico, con sus tests (estilo en `CLAUDE.md`).
2. Skill `validar-ci`.
3. Rama, PR, CI en verde, _rebase and merge_.

## Errores comunes

| Error                                                          | En su lugar                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| El permiso solo en la guarda del router                        | El backend decide; la guarda solo esconde                                       |
| Comparar un estado con su texto traducido                      | Comparar con el valor del contrato (`"FINISHED"`)                               |
| Emitir el evento dentro de la transacción                      | Después de confirmarla (`docs/decisions/003-los-eventos-solo-avisan.md`)        |
| Validar el estado del torneo antes de `lockTournament`         | Bloquear primero, validar después                                               |
| Un `SELECT` nuevo que cuenta inscritos sin `withdrawnAt: null` | Filtrar los retirados (`docs/decisions/007-retirar-conserva-la-inscripcion.md`) |
