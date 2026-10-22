# Migraciones de la base

El modelo vive en `backend/prisma/schema.prisma` y su historial en `backend/prisma/migrations/`. Todo comando, desde `backend/`.

## Un cambio al modelo

1. Editar `schema.prisma`.
2. `npm run prisma:migrate -- --name <descripcion_en_minusculas>`: genera la migración y la aplica a la base de `DATABASE_URL` (la local de desarrollo).
3. `npm run prisma:generate`: regenera el cliente en `src/generated/prisma` (Prisma 7 ya no lo hace solo, ni corre el seed).
4. Leer el SQL generado antes de hacer commit. Prisma borra y vuelve a crear columnas cuando cambia un tipo: con datos, eso pierde los datos.

## Lo que Prisma no expresa

Se escribe a mano en el `migration.sql`, con un comentario que diga para qué es:

- Restricciones `CHECK` (ver `migrations/*_add_check_constraints`).
- Extensiones: `CREATE EXTENSION IF NOT EXISTS <nombre>;` (ver `migrations/20261022000000_unaccent`). Solo extensiones _trusted_ (como `unaccent` o `pg_trgm`), que el dueño de la base puede crear sin ser superusuario: así funcionan en producción.
- Cambios de tipo que conservan datos (ver `migrations/*_native_uuid_ids`).

Para una migración solo de SQL, sin cambio al esquema: crear la carpeta `migrations/AAAAMMDDHHMMSS_<descripcion>/` con un `migration.sql`, o `npx prisma migrate dev --create-only --name <descripcion>` y editar lo que genere.

Una migración que ya se aplicó en algún lado no se edita: se escribe otra.

## Dónde se aplican

| Dónde                    | Cómo                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Base local de desarrollo | `npm run prisma:migrate` (`migrate dev`)                                                                                        |
| Suite de integración     | La aplica sola (`migrate deploy`) sobre la base `_test` al empezar (`src/testing/integrationGlobalSetup.ts`)                    |
| CI                       | Igual, sobre el PostgreSQL de servicio del job                                                                                  |
| Producción (Render)      | `npm start` corre `prisma migrate deploy` antes de arrancar. Si una migración falla, Render sigue sirviendo la versión anterior |

## Antes de desplegar una migración con riesgo

Si borra o transforma datos: respaldo de la base de producción con `pg_dump` (ver [despliegue](despliegue.md#volver-atrás)), y ensayarla antes sobre una copia.

## Después

- Si la migración agrega una restricción o un tipo nuevo, una prueba de integración que lo ejercite (`*.int.test.ts`).
- Si cambia un enum, `src/contracts/contracts.test.ts` exige que el contrato tenga los mismos valores.
