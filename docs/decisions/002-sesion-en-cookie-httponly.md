# 002. La sesión es una cookie que ningún script lee

Vigente desde septiembre de 2026. Endurecida en octubre de 2026 (emisor y audiencia obligatorios).

## Contexto

La sesión empezó como un JWT guardado en el navegador: cualquier XSS podía llevárselo, y el token seguía sirviendo hasta vencer aunque la cuenta se bloqueara o cambiara de rol. Además, frontend (Vercel) y backend (Render) están en sitios distintos, y los navegadores bloquean las cookies de terceros.

## Decisión

- El JWT viaja en la cookie `torre_session`: `HttpOnly`, `SameSite=Lax`, `Secure` en producción, `Path=/api`. La pone `/auth/login`; la app no ve el token. También se acepta `Authorization: Bearer` para clientes que no son navegador.
- Vercel reescribe `/api` hacia Render, así la API queda en el mismo sitio que la app y la cookie es propia.
- Un cambio (`POST`, `PUT`, `PATCH`, `DELETE`) con la cookie tiene que venir de la propia app (`Sec-Fetch-Site`, o `Origin`/`Referer` igual a `CORS_ORIGIN`/`APP_URL`); si no, `403 CROSS_SITE_REQUEST` (defensa contra CSRF).
- En cada petición se confirma en la base que la cuenta sigue activa, con el mismo rol y sin sesiones revocadas desde que se emitió el token.
- Todo token lleva emisor y audiencia, y se rechaza el que no los trae.
- El socket va directo a Render (Vercel no reescribe WebSockets), adonde la cookie no llega: se identifica con un ticket de un minuto (`POST /api/auth/socket-ticket`) firmado para otra audiencia, que no sirve como sesión.

## Consecuencias

- Un XSS no puede robar la sesión; un bloqueo, una supresión de datos o un cambio de rol surten efecto en la siguiente petición.
- Cada petición autenticada hace una consulta a la base.
- La dirección de Render aparece en `vercel.json` y en `.env.production`, y deben coincidir (`deployment.test.ts`).

## Dónde está

- `backend/src/services/sessionToken.ts` (sesión y ticket: algoritmo, emisor, audiencias), `backend/src/middlewares/sessionCookie.ts` (cookie y origen), `backend/src/middlewares/auth.ts` (`requireAuth`).
- `frontend/vercel.json`, `frontend/src/services/socket.ts`.
- Pasos de despliegue: [`runbooks/despliegue.md`](../runbooks/despliegue.md).
