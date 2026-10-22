# Despliegue

El frontend se publica en **Vercel** (`https://torre-roan.vercel.app`) y el backend con su base PostgreSQL en **Render** (`https://torre-be.onrender.com`). Los dos despliegan solos desde `main`.

## Cómo se conectan

```
Navegador ── https://torre-roan.vercel.app ──────────► Vercel: la app (dist/)
   │                         └── /api/* ──(rewrite)──► Render: torre-be.onrender.com/api/*
   └── wss://torre-be.onrender.com/socket.io ────────► Render: Socket.IO (con ticket)
```

- **La API pasa por Vercel** para que la cookie de sesión sea del mismo sitio que la app ([decisión 002](../decisions/002-sesion-en-cookie-httponly.md)). La app siempre llama a `/api` de su propio origen; en desarrollo lo redirige el servidor de Vite.
- **El socket va directo a Render** (Vercel no reescribe WebSockets), con un ticket de un minuto. Su dirección sale de `frontend/.env.production`, y la CSP de `vercel.json` la admite en `connect-src`.
- **Nada se cachea en el camino**: toda respuesta de la API lleva `Cache-Control: no-store`.

## Render (backend)

| Ajuste            | Valor                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Root Directory    | `backend`                                                                                                                       |
| Build Command     | `npm ci && npm run build` (`backend/.npmrc` hace que se instalen también las dependencias de desarrollo, que compilar necesita) |
| Start Command     | `npm start`: aplica las migraciones pendientes y arranca. No `node dist/server.js`: así no migraría                             |
| Health Check Path | `/api/health`                                                                                                                   |

| Variable       | Valor                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------- |
| `NODE_ENV`     | `production`                                                                                 |
| `DATABASE_URL` | La _Internal Database URL_ de la base de Render                                              |
| `JWT_SECRET`   | 32 caracteres aleatorios o más (`openssl rand -hex 32`). Cambiarlo cierra todas las sesiones |
| `CORS_ORIGIN`  | `https://torre-roan.vercel.app`, exactamente                                                 |
| `APP_URL`      | `https://torre-roan.vercel.app` (base de los enlaces que la API envía por correo)            |
| `TRUST_PROXY`  | `2` (Vercel y el balanceador de Render)                                                      |
| `SMTP_URL`     | Opcional. Sin él, todo funciona salvo la recuperación de contraseña                          |
| `MAIL_FROM`    | Con `SMTP_URL`: `Torre Central Hub <no-reply@dominio>`                                       |

Todas las variables y su validación: [`backend/README.md`](../../backend/README.md#variables-de-entorno).

## Vercel (frontend)

- Root Directory `frontend`, Framework Preset _Vite_, y _Include files outside the root directory in the Build Step_ activada: el build lee `backend/src/contracts/`.
- No definir `VITE_SOCKET_URL` en Vercel: le gana a `.env.production`, y un valor distinto deja la sala en vivo sin actualizarse.

## Desplegar

Merge a `main`. Vercel suele terminar antes que Render; hasta que Render compile y migre (unos minutos), la app nueva habla con el backend viejo. Si hay una migración con riesgo, antes: respaldo (ver [Volver atrás](#volver-atrás)) y [`migraciones.md`](migraciones.md).

## Verificar

1. Logs de Render: `All migrations have been successfully applied` (o `No pending migrations to apply`) y la línea de arranque.
2. `https://torre-roan.vercel.app/api/health` responde `{"status":"ok"}`.
3. Iniciar sesión: la cookie `torre_session` aparece para `torre-roan.vercel.app` con `HttpOnly`, `Secure`, `SameSite=Lax` y `Path=/api`; en _Local Storage_ no hay ningún token.
4. Guardar un cambio (el nombre en _Mi perfil_). Un `403` "La petición no viene de la aplicación" es un problema de origen (`CORS_ORIGIN`, `APP_URL`).
5. Abrir la sala en vivo de un torneo: en _Network → WS_, una conexión abierta a `wss://torre-be.onrender.com/socket.io`, sin errores de CSP en la consola.

## Si algo sale mal

| Síntoma                                                | Causa probable                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Render no arranca: `Invalid environment configuration` | Falta una variable obligatoria o no sirve; el log dice cuál                                       |
| Se inicia sesión y la página siguiente vuelve al login | Render todavía no terminó de desplegar, o Vercel sirve un build viejo (_Redeploy_)                |
| La sala en vivo no se actualiza sola                   | `CORS_ORIGIN` no es exactamente la URL de Vercel, o Vercel tiene `VITE_SOCKET_URL` con otro valor |
| Una migración falla                                    | El log de Render dice cuál; Render sigue sirviendo la versión anterior                            |

## Volver atrás

- Antes de una migración con riesgo: `pg_dump "<External Database URL>" --format=custom --file=torre-respaldo.dump`.
- Render: _Rollback_ al despliegue anterior. Vercel: _Instant Rollback_.
- Si las migraciones cambiaron el esquema, la versión anterior necesita también la base de antes: `pg_restore --clean --if-exists --no-owner --dbname "<External Database URL>" torre-respaldo.dump` (descarta lo escrito después del respaldo).

## Si cambia la dirección del backend

Cambiarla en `frontend/vercel.json` (el `destination` de `/api` y `connect-src` de la CSP, `https://` y `wss://`) y en `frontend/.env.production`. `frontend/src/deployment.test.ts` falla si no coinciden.

## Una base nueva

Después del primer `npm start`, el primer administrador, una sola vez:

```bash
ADMIN_NAME="…" ADMIN_EMAIL="…" ADMIN_PASSWORD="…" npm run bootstrap
```

`npm run prisma:seed` se niega a correr en producción: sus cuentas de prueba tienen una contraseña publicada en el repositorio.

## Límites conocidos

- La primera petición tras 15 minutos sin uso tarda hasta cerca de un minuto: el plan gratuito de Render duerme el servicio.
- Los límites de peticiones por dirección confían en la IP que informa el proxy: quien llame directo a Render puede falsear `X-Forwarded-For`. Por eso el login tiene además un límite por cuenta para navegadores desconocidos ([`backend/README.md`](../../backend/README.md#sesión-y-cuenta)).
