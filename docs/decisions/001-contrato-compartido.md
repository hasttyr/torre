# 001. El contrato de la API se comparte, no se copia

Vigente desde septiembre de 2026.

## Contexto

Frontend y backend son dos proyectos npm. Mientras cada uno tenía su copia de los catálogos (roles, estados, resultados) y de las formas de las respuestas, se desalineaban sin que nada fallara: el frontend llegó a enviar `type: "ACCESO"` cuando la API solo aceptaba `"ACCESS"`, y las solicitudes de derechos sobre datos (HU22) respondían 400 a todo el mundo.

## Decisión

`backend/src/contracts/` es la única definición de los catálogos, los códigos de error (`errors.ts`) y el tipo de cada respuesta (`responses.ts`). El frontend la importa como `@contracts` y compila contra esos mismos archivos; sus servicios exponen cada tipo en su forma JSON con `Serialized<T>` (las fechas llegan como texto).

## Consecuencias

- Un campo renombrado o un valor de catálogo nuevo rompe el build del lado que no lo sigue: el desalineamiento aparece al compilar, no en producción.
- `contracts/` no puede importar nada de fuera de ella (ni Prisma, ni zod, ni Node), porque la compila también el frontend.
- El build del frontend necesita el repositorio completo: en Vercel, _Include files outside the root directory in the Build Step_.
- Lo que el frontend _envía_ sigue tipado en sus servicios, y lo fija `services/http.test.ts`.

## Dónde está

- `backend/src/contracts/` y su `contracts.test.ts` (que no importe nada de fuera; que los enums de la base y los esquemas zod acepten exactamente los valores del contrato).
- El alias `@contracts` en `frontend/vite.config.ts`, `frontend/vitest.config.ts` y `frontend/tsconfig.app.json`.
- `frontend/src/contracts.test.ts`: cada valor que la interfaz muestra tiene texto en español e inglés.
