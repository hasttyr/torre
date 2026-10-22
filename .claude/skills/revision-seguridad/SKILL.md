---
name: revision-seguridad
description: "Usar cuando se revisa la seguridad o la privacidad de torre, o un cambio que toca sesión, permisos, búsqueda o listados de personas, datos personales (Ley 1581), la bitácora, límites de peticiones, recuperación de contraseña, SQL crudo o cabeceras de despliegue."
---

# Revisión de seguridad de torre

Los riesgos propios de este sistema y dónde mirar. Complementa la skill general `security-audit` con el modelo de amenazas del proyecto.

## Quién ataca y qué protege

- **Actores**: anónimo; cualquiera que se registre como `PLAYER` o `COACH` (autoservicio); roles de personal (`ORGANIZER`, `ARBITER`, `ADMINISTRATOR`), que asigna un administrador; quien llama directo a Render saltándose Vercel y puede falsear `X-Forwarded-For`.
- **Activos**: datos personales de estudiantes (correo, código, programa, semestre, fecha de nacimiento, género, discapacidad) bajo la Ley 1581; resultados oficiales; la integridad de la bitácora; las cuentas.

## Qué revisar

| Área                       | Preguntas                                                                                                                                                                                            | Dónde                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Autorización               | ¿La ruta tiene su compuerta y el servicio revisa el recurso concreto (`:id`) contra quien pide? ¿Un coach ve algo de un jugador antes de que acepte (HU24)?                                          | `routes/`, `services/tournamentAccess.ts`, `services/dashboard/scopes.ts`                        |
| Exposición de datos        | ¿La respuesta trae solo lo que la pantalla usa (nunca el correo en resultados)? ¿Un rol de autoservicio puede recorrer el directorio con consultas cortas?                                           | `contracts/responses.ts`, `services/players.service.ts` (decisión 006)                           |
| Sesión                     | Cookie `HttpOnly`/`SameSite`/`Path`, chequeo de origen en los cambios, emisor y audiencia del JWT, verificación en la base por petición, audiencia propia del ticket del socket, revocación al salir | `services/sessionToken.ts`, `middlewares/sessionCookie.ts`, `middlewares/auth.ts` (decisión 002) |
| Entrada                    | ¿Todo campo pasa por zod con longitud y techo numérico? ¿Los ids son UUID? ¿El SQL crudo usa parámetros de plantilla?                                                                                | `validators/`, `validators/fields.ts`, `$queryRaw`                                               |
| Bitácora                   | ¿La acción crítica se audita en su transacción? ¿Se nombra a las personas con `mention()` y el texto del usuario pasa por `plain()`?                                                                 | `services/auditLog.service.ts` (decisión 005)                                                    |
| Enumeración y fuerza bruta | ¿La respuesta es la misma exista o no la cuenta? ¿Hay límite de intentos, también por cuenta para navegadores desconocidos? ¿El enlace de recuperación es de un solo uso, vence y anula los demás?   | `middlewares/rateLimits.ts`, `services/deviceToken.ts`, `services/resetLinkSender.ts`            |
| Configuración              | ¿Nada secreto en `.env.production` ni `vercel.json`? ¿Un token o enlace de recuperación puede terminar en un log?                                                                                    | `config/env.ts`, `frontend/.env.production`                                                      |
| Navegador                  | ¿La CSP sigue sin scripts en línea (salvo el de tema, por hash)? ¿Algún `v-html` con texto del usuario? ¿Algún token en `localStorage`?                                                              | `frontend/vercel.json`, `frontend/src/deployment.test.ts`                                        |
| Dependencias               | `npm audit --audit-level=high` en los dos proyectos                                                                                                                                                  | `docs/runbooks/validar-ci.md`                                                                    |

Hallazgos de auditorías anteriores, para no reabrirlos: límite de login por cuenta en navegadores desconocidos; búsqueda del coach sin fragmentos; enlace de recuperación de un solo uso que anula los demás; tokens sin emisor ni audiencia rechazados; texto escrito en la bitácora que no puede nombrar a nadie; techos para los números.

## Informar

Cada hallazgo: severidad, `archivo:línea`, escenario concreto (quién, qué hace, qué obtiene) y arreglo propuesto. Un arreglo de privacidad se prueba contra la base real (patrón de `backend/src/routes/privacy.int.test.ts`).

Si el arreglo empeora la usabilidad, decirlo y proponer un punto medio que mantenga el límite; no cambiar seguridad por comodidad sin preguntar (decisión 006).
