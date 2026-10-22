# Validar como el CI

Qué corre el CI en cada PR y en cada push a `main` (`.github/workflows/ci.yml`), cómo correrlo en local y qué hacer con los fallos que no son del código.

## Lo que corre el CI

| Job        | Pasos, en orden                                                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend`  | `npm ci`, `npx prisma generate`, `npm run lint`, `npx tsc --noEmit`, `npm run format:check`, `npm run test:coverage` (con PostgreSQL), `npm run build` sin `*.test.js` en `dist/`, `npm audit --audit-level=high` |
| `frontend` | `npm ci`, `npm run lint`, `npm run format:check`, `npm run build` (incluye `vue-tsc`), `npm run test:coverage`, `npm audit --audit-level=high`                                                                    |
| `e2e`      | Playwright (`npm run test:e2e`) contra el build de producción y la API real, sobre una base propia                                                                                                                |

Un PR se fusiona solo con los tres en verde.

## En local (PowerShell)

Desde `backend/`:

```powershell
npm run lint; npx tsc --noEmit; npm run format:check
npm run test:coverage        # unitarias + integración, con umbrales
npm run build; (Get-ChildItem -Recurse dist -Filter *.test.js).Count   # tiene que dar 0
npm audit --audit-level=high
```

Desde `frontend/`:

```powershell
npm run lint; npm run format:check; npm run build
npm run test:coverage
npm audit --audit-level=high
npm run test:e2e             # la primera vez: npx playwright install chromium
```

La suite de integración (`npm run test:integration`, y por tanto `test:coverage`) usa `TEST_DATABASE_URL` o, si no está, la base de `DATABASE_URL` de `backend/.env` con el sufijo `_test`. Le aplica las migraciones y la vacía antes de cada prueba; se niega a correr contra una base cuyo nombre no termine en `_test`. En este equipo hay un PostgreSQL local, así que corre en local.

Mientras se trabaja basta con lo cercano al cambio (`npx vitest run <archivo>`, en el backend con `--project unit` o `--project integration`). Lo completo, antes de decir que algo está listo.

## Fallos que no son del código

| Síntoma                                                                                                    | Qué es y qué hacer                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| En local, la cobertura de ramas del frontend queda apenas bajo el umbral y el CI pasa                      | `frontend/.env` (no versionado) define `VITE_SOCKET_URL`, así que en `services/socket.ts` nunca se toma el valor por defecto. Si la única diferencia con el CI es `socket.ts`, no es un problema. Manda el CI                                                                                                               |
| En Windows, `Worker exited unexpectedly with exit code 3221226505` en `auth.rateLimit.routes.test.ts`      | Un cierre nativo del proceso de Vitest (0xC0000409) que pasa también en `main`, de vez en cuando. Volver a correr ese archivo. En el CI (Linux) no pasa                                                                                                                                                                     |
| `npm audit` falla con `503 Service Unavailable`, un timeout, o `400 Invalid package tree` (`audits/quick`) | El servicio de auditoría de npm, no una vulnerabilidad. En local: `npm audit --loglevel=http` tiene que mostrar `POST 200 …/advisories/bulk`. En el CI: `gh run rerun <run-id> --failed`                                                                                                                                    |
| `npm audit` lista vulnerabilidades `high` sin haber cambiado dependencias                                  | Avisos nuevos publicados desde la última corrida. Subir la dependencia (`npm update <paquete>`, o `npm install -D <paquete>@^<versión>` si un par de paquetes se exigen la misma versión) y volver a correr todo: una actualización puede cambiar la cobertura ([decisión 008](../decisions/008-la-cobertura-solo-sube.md)) |
| `npm install` tarda varios minutos                                                                         | El registro de npm lento; no está colgado                                                                                                                                                                                                                                                                                   |

## Leer el CI desde la terminal

```powershell
gh pr checks <pr>                                   # estado de cada job
gh run view <run-id> --log-failed                   # solo los pasos que fallaron (con el run terminado)
gh api --allow-escape-sequences repos/hasttyr/torre/actions/jobs/<job-id>/logs   # el log de un job aunque el run siga corriendo
gh run watch <run-id> --exit-status                 # esperar a que termine
```
