# Despliegue — Torre Central Hub

El frontend se publica en **Vercel** (`https://torre-roan.vercel.app`) y el backend en **Render** (`https://torre-be.onrender.com`), con su base PostgreSQL. Los dos despliegan solos desde la rama `main` de GitHub. Esta guía dice cómo se conectan, qué configurar en cada uno y cómo actualizar una instalación que ya tiene datos.

## Cómo se conectan

```
Navegador ── https://torre-roan.vercel.app ──────────► Vercel: la app (dist/)
   │                         └── /api/* ──(rewrite)──► Render: torre-be.onrender.com/api/*
   └── wss://torre-be.onrender.com/socket.io ────────► Render: Socket.IO (con ticket)
```

- **La API pasa por Vercel.** La sesión es una cookie `HttpOnly` (`torre_session`) que la API pone al iniciar sesión: ningún script de la página la puede leer, así que un XSS no puede robarla. Para que el navegador la envíe tiene que ser del mismo sitio que la app. `vercel.app` y `onrender.com` son sitios distintos, y los navegadores bloquean las cookies de terceros. Por eso [`frontend/vercel.json`](../frontend/vercel.json) reescribe `/api/*` hacia Render: para el navegador, la API está en `https://torre-roan.vercel.app/api`. La app siempre llama a `/api` de su propio origen; en desarrollo y en `vite preview` hace lo mismo el proxy de Vite.
- **El socket va directo a Render**, porque las reescrituras de Vercel no llevan WebSockets. Allí la cookie no viaja: la app pide antes un ticket de un minuto (`POST /api/auth/socket-ticket`, con la cookie) y lo presenta al conectarse. La dirección sale de [`frontend/.env.production`](../frontend/.env.production), y la Content-Security-Policy de `vercel.json` la admite en `connect-src` y ninguna otra.
- **Nada se cachea en el camino.** Toda respuesta de la API lleva `Cache-Control: no-store`: el CDN de Vercel respeta esa cabecera en las reescrituras, y un equipo compartido del laboratorio no guarda en caché datos de otra persona.

## Actualizar a esta versión, paso a paso

Para la instalación que ya está en línea, con datos. Una base nueva, sin datos, sigue los mismos pasos 2 a 6 y luego [Base nueva](#base-nueva).

### 1. Respaldo de la base

La actualización aplica 7 migraciones sobre los datos; una convierte todos los ids de texto a `uuid`. Se ensayó sobre una copia hecha con la versión desplegada (sin perder ninguna fila), pero un respaldo es lo que permite volver atrás. Con la _External Database URL_ de la base (Render → la base → _Connect_):

```bash
pg_dump "<External Database URL>" --format=custom --file=torre-antes-de-actualizar.dump
```

`pg_dump` viene con PostgreSQL. Si hiciera falta volver atrás, ver [Si algo sale mal](#si-algo-sale-mal).

### 2. Render → el servicio del backend → Settings

| Ajuste            | Valor                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root Directory    | `backend`                                                                                                                                           |
| Build Command     | `npm ci && npm run build`. [`backend/.npmrc`](../backend/.npmrc) hace que npm instale también las dependencias de desarrollo, que compilar necesita |
| Start Command     | `npm start`. Aplica las migraciones pendientes (si no hay, no hace nada) y arranca el servidor. No `node dist/server.js` directo: así no migraría   |
| Health Check Path | `/api/health`                                                                                                                                       |

Node sale de `engines` en `backend/package.json` (22.12 o superior).

### 3. Render → el servicio del backend → Environment

| Variable       | Valor                                                                                            | ¿Obligatoria?     |
| -------------- | ------------------------------------------------------------------------------------------------ | ----------------- |
| `NODE_ENV`     | `production`                                                                                     | Sí                |
| `DATABASE_URL` | La _Internal Database URL_ de la base de Render                                                  | Sí                |
| `JWT_SECRET`   | 32 caracteres aleatorios o más: `openssl rand -hex 32`. Con uno más corto el servidor no arranca | Sí                |
| `CORS_ORIGIN`  | `https://torre-roan.vercel.app`, exactamente: con `https`, no `http`                             | Sí                |
| `APP_URL`      | `https://torre-roan.vercel.app`: base de los enlaces que la API envía por correo                 | Recomendada       |
| `TRUST_PROXY`  | `2`: Vercel y el balanceador de Render (se comprueba en el paso 6)                               | Sí                |
| `SMTP_URL`     | El proveedor de correo, p. ej. `smtps://usuario:clave@smtp.proveedor.com:465`                    | No: ver abajo     |
| `MAIL_FROM`    | `Torre Central Hub <no-reply@dominio>`                                                           | Si hay `SMTP_URL` |

- **Sin `SMTP_URL`**, la app funciona completa salvo la recuperación de contraseña: al pedirla, la página dice que no está disponible, y el log de Render lo avisa al arrancar. Sirve cualquier proveedor SMTP. Con Gmail, por ejemplo, se usa una _contraseña de aplicación_ (sin los espacios con que Google la muestra) y la `@` del usuario se escribe `%40`: `smtps://tucorreo%40gmail.com:contraseña-de-aplicacion@smtp.gmail.com:465`.
- **Un `JWT_SECRET` nuevo** cierra todas las sesiones abiertas. Al pasar a esta versión se cierran igual (ver [Qué notarán los usuarios](#qué-notarán-los-usuarios)), así que es el momento de poner uno fuerte.
- Render fija `PORT` por su cuenta: no hace falta definirla.

Al guardar, si Render ofrece desplegar, alcanza con **guardar sin desplegar** (_Save only_ o equivalente): el push del paso 5 despliega la versión nueva.

### 4. Vercel → el proyecto → Settings

- **General:** Root Directory `frontend`, Framework Preset _Vite_, y la opción _Include files outside the root directory in the Build Step_ activada (lo está por defecto): el build lee el contrato de `backend/src/contracts/`.
- **Environment Variables:**
  - Borrar `VITE_API_URL` si existe. Ya no se usa.
  - **No** definir `VITE_SOCKET_URL`: la dirección del socket viene de `frontend/.env.production`. Si ya existe, bórrala o deja exactamente `https://torre-be.onrender.com`: una variable de Vercel le gana a ese archivo, y un valor distinto deja la sala en vivo sin actualizarse.

### 5. Desplegar

Con los pasos 2 a 4 listos, se hace commit y push a `main`, mejor a una hora en que nadie use la app. Vercel y Render despliegan solos. Vercel suele terminar primero; hasta que Render termine de compilar y migrar (unos minutos), la app nueva habla con el backend viejo y los inicios de sesión fallan.

### 6. Verificar

1. **Render → Logs** del despliegue: `All migrations have been successfully applied` (o `No pending migrations to apply`) y después la línea de arranque del servidor. Sin `SMTP_URL`, también el aviso `password recovery is off`.
2. `https://torre-roan.vercel.app/api/health` responde `{"status":"ok"}`: la reescritura llega a Render.
3. **Iniciar sesión** en `https://torre-roan.vercel.app`. En las herramientas del navegador (_Application → Cookies_), `torre_session` aparece para `torre-roan.vercel.app` con `HttpOnly`, `Secure`, `SameSite=Lax` y `Path=/api`. En _Local Storage_ no hay ningún token.
4. **Guardar un cambio**, por ejemplo el nombre en _Mi perfil_: tiene que guardarse. Un `403` ("La petición no viene de la aplicación") indica un problema de origen (ver [Si algo sale mal](#si-algo-sale-mal)).
5. **Abrir la sala en vivo** de un torneo. En _Network → WS_ hay una conexión a `wss://torre-be.onrender.com/socket.io` que sigue abierta, y la consola no muestra errores de CSP.
6. **`TRUST_PROXY`:** en los logs de Render, cada petición registra `ip`. La de tu inicio de sesión debe ser tu IP pública (la que muestra cualquier sitio de "cuál es mi IP"). Si aparece otra dirección que no es la tuya, falta un salto: sube `TRUST_PROXY` en uno y repite. Nunca más de lo necesario: cada salto de más deja que un cliente elija la IP que ve el servidor. Si quedara corto, todos los usuarios compartirían la IP de Vercel y, con ella, los límites de peticiones.

### 7. Una sola vez, sobre la base de producción

Las entradas de auditoría escritas antes de esta versión guardan nombres como texto, que una supresión de datos (HU22) no alcanza. Este comando los reemplaza por referencias a cada persona; lo que no puede atribuir a una sola persona lo deja como está y lo lista para revisión. Se puede correr desde el _Shell_ del servicio en Render (planes de pago), o desde tu equipo con la _External Database URL_. Desde tu equipo, en `backend/`:

```bash
npm ci && npm run build
DATABASE_URL="<External Database URL>" npm run audit:link-names             # solo informa qué haría
DATABASE_URL="<External Database URL>" npm run audit:link-names -- --apply  # lo escribe, en una transacción
DATABASE_URL="<External Database URL>" npm run passwords:legacy             # cuántas cuentas conservan un hash bcrypt
```

En PowerShell, la variable se fija antes: `$env:DATABASE_URL="<External Database URL>"; npm run audit:link-names`. Un `DATABASE_URL` puesto así le gana al `.env` local, así que el comando va a producción, no a tu base de desarrollo. Después de terminar, cierra esa terminal (o `Remove-Item Env:DATABASE_URL`) para no dejarla apuntando a producción.

`passwords:legacy` es informativo: cada contraseña antigua (bcrypt) se reemplaza sola cuando su dueño vuelve a iniciar sesión, y `bcryptjs` sobra cuando el conteo llega a 0.

## Qué notarán los usuarios

- **Todos tienen que iniciar sesión otra vez**, una sola vez: la sesión pasó de un token guardado en el navegador a una cookie.
- **Los vínculos entrenador–jugador que ya existían quedan pendientes** hasta que el jugador los acepte (HU24, Ley 1581: antes nunca se pidió su consentimiento). Mientras tanto, el entrenador no ve los datos de ese jugador. Conviene avisar a los jugadores que revisen sus solicitudes en _Mi perfil_.
- **Sin `SMTP_URL`**, "¿Olvidaste tu contraseña?" dice que la recuperación no está disponible y que pidan ayuda a un administrador.
- **La primera petición después de 15 minutos sin uso tarda hasta cerca de un minuto**: el plan gratuito de Render duerme el servicio. Vercel espera hasta dos minutos, así que no falla, solo tarda.

## Base nueva

Con la base recién creada (el primer `npm start` la migra), se crea el primer administrador una sola vez, desde el _Shell_ de Render o desde tu equipo como en el paso 7:

```bash
ADMIN_NAME="…" ADMIN_EMAIL="…" ADMIN_PASSWORD="…" npm run bootstrap
```

Es seguro repetirlo: si ya hay un administrador activo, no crea otro. `npm run prisma:seed` se niega a correr en producción, porque sus cuentas de prueba comparten una contraseña publicada en el repositorio.

## Si algo sale mal

| Síntoma                                                              | Causa probable y qué hacer                                                                                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Render no arranca y el log dice `Invalid environment configuration`  | Falta una variable obligatoria o no sirve (el log dice cuál): corrígela en _Environment_ y vuelve a desplegar                                                             |
| El despliegue de Render falla al compilar                            | Revisa que el Build Command sea `npm ci && npm run build` y que `backend/.npmrc` esté en el repositorio                                                                   |
| Se inicia sesión y la página siguiente vuelve al login               | La cookie no llega: Render todavía no terminó de desplegar (espera y recarga) o Vercel sirve un build viejo (_Redeploy_)                                                  |
| Todo cambio responde `403` ("La petición no viene de la aplicación") | En un navegador actual no debería pasar. En uno antiguo, `CORS_ORIGIN` o `APP_URL` no coinciden con la dirección de la app (`https://`, sin ruta)                         |
| La sala en vivo no se actualiza sola                                 | `CORS_ORIGIN` no es exactamente `https://torre-roan.vercel.app`, o Vercel tiene definida `VITE_SOCKET_URL` con otro valor (bórrala y haz _Redeploy_)                      |
| Una migración falla                                                  | El log de Render dice cuál. Render sigue sirviendo la versión anterior si la nueva no arranca; revisa el error antes de reintentar y, si hace falta, restaura el respaldo |

**Volver a la versión anterior:** en Render, _Rollback_ al despliegue previo; en Vercel, _Instant Rollback_ (o _Promote_) del despliegue previo. Como las migraciones cambiaron el esquema, la versión anterior necesita también la base de antes: restaura el respaldo del paso 1 con `pg_restore --clean --if-exists --no-owner --dbname "<External Database URL>" torre-antes-de-actualizar.dump`. Eso descarta lo que se haya escrito después del respaldo.

## Si cambia la dirección del backend

La dirección de Render aparece en el repositorio, en dos archivos que deben coincidir. `frontend/src/deployment.test.ts` (constante `API`) falla si no coinciden:

1. `frontend/vercel.json`: el `destination` de la reescritura de `/api` y el `connect-src` de la CSP (`https://…` y `wss://…`).
2. `frontend/.env.production`: `VITE_SOCKET_URL`.

## Límites conocidos

- **Los límites de peticiones confían en la IP que informa el proxy.** Quien llame directo a `torre-be.onrender.com` (sin pasar por Vercel) puede enviar un `X-Forwarded-For` falso y elegir la IP que ven los límites por dirección, incluidos los intentos de login por IP y correo. Vercel no permite añadir a la reescritura una cabecera secreta que el backend pueda comprobar. Cerrarlo del todo exige un límite por cuenta sin importar la IP, y eso permitiría que un extraño bloquee a propósito el acceso de otra persona. Hoy se deja así: el hash de la contraseña (scrypt) hace costoso cada intento, y el log registra cada intento fallido (un `401` en `/api/auth/login`) con la IP que vio el servidor.
