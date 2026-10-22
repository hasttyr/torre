# Torre Central Hub

Gestión de torneos de ajedrez universitarios (Universidad Central, Práctica de Ingeniería IV): inscripción, emparejamiento suizo, resultados, clasificación con desempates y cierre oficial, en tiempo real y con bitácora de auditoría. Lo usan personas reales de la universidad: los datos personales se rigen por la Ley 1581 de 2012 (Colombia).

Este archivo es el contexto de entrada. El detalle está en los README de cada proyecto y en `docs/`; aquí va lo que no se ve leyendo el código.

## Mapa

| Dónde                      | Qué                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `backend/`                 | API REST (Express 5, Prisma 7, PostgreSQL) y Socket.IO → `backend/CLAUDE.md`, `backend/README.md` |
| `frontend/`                | SPA Vue 3 (Vite, Pinia Colada, vue-i18n, Tailwind 4) → `frontend/CLAUDE.md`, `frontend/README.md` |
| `backend/src/contracts/`   | Contrato de la API, compilado por los dos proyectos (alias `@contracts` en el frontend)           |
| `docs/architecture.md`     | Cómo encajan las piezas y la estrategia de pruebas                                                |
| `docs/decisions/`          | Por qué el sistema es como es. Leer antes de cambiar algo que parezca raro                        |
| `docs/runbooks/`           | Paso a paso: validar como el CI, migraciones, despliegue, regresión P01–P33                       |
| `.github/workflows/ci.yml` | Las compuertas que tiene que pasar cada PR                                                        |
| `.claude/skills/`          | `/validar-ci`, `/nueva-feature`, `/arreglar-bug`, `/revision-seguridad`                           |

## Glosario

- **HUxx**: historia de usuario (HU01–HU30), **RN-xx**: regla de negocio. Vienen del documento de sustentación, que ya no está en el repo; el código las cita en comentarios para decir de dónde sale una regla.
- Reglas que más se tocan: RN-01 no inscribir dos veces, RN-02 no repetir enfrentamientos, RN-03 catálogo de resultados, RN-04 solo cuenta lo publicado, RN-05 orden de desempates fijo desde la ronda 1, RN-06 quién registra resultados, RN-07 un retirado no se empareja, RN-08 bye, RN-09 ajuste manual con motivo, RN-10 consentimiento de la política de datos, RN-11 acciones críticas a la bitácora.
- **Roles**: `PLAYER` y `COACH` se registran solos; `ORGANIZER`, `ARBITER` y `ADMINISTRATOR` los asigna un administrador. Que cualquiera pueda ser `COACH` importa para la privacidad (ver `docs/decisions/006-busqueda-de-jugadores-del-coach.md`).
- **Estados del torneo**: `CREATED` → `REGISTRATION_OPEN` → `REGISTRATION_CLOSED` → `IN_PROGRESS` → `FINISHED`. Las inscripciones se abren una sola vez, y las rondas solo se generan con ellas cerradas.

## Cómo se trabaja aquí

- **Idiomas.** Código, identificadores, comentarios y mensajes de commit en inglés. Textos de la interfaz en `frontend/src/i18n/locales/es.json` (por defecto) y `en.json`, siempre en los dos. README y `docs/` en español.
- **Commits.** Un asunto en inglés que dice el comportamiento en palabras simples, sin prefijos tipo `fix:` ("A withdrawn player can be enrolled again"), y un cuerpo que explica el porqué. Un commit por cambio lógico, con sus tests. Termina con la línea `Co-Authored-By` que indique la sesión.
- **Comentarios.** Explican el porqué y citan la HU/RN cuando una regla viene de ahí. Imitar la densidad y el tono del archivo que se edita.
- **Tests.** Junto al archivo que prueban (`x.ts` → `x.test.ts`, `x.int.test.ts`). Un bug se reproduce primero con un test que falle. Los umbrales de cobertura solo suben (`docs/decisions/008-la-cobertura-solo-sube.md`).
- **Ramas y PR.** Nada directo a `main`: rama, PR, CI en verde y _rebase and merge_ (historial lineal, un commit por cambio).
- **Antes de decir "listo"**, correr `/validar-ci`. Si algo no se pudo comprobar, decirlo.
- **Seguridad sobre comodidad.** Un arreglo de seguridad no se deshace por usabilidad sin preguntar: se busca un punto medio (ejemplo en la decisión 006).

## Entorno de desarrollo

- Windows con PowerShell. Para un mensaje de commit de varias líneas: escribirlo en un archivo y `git commit -F <archivo>`. Un here-string puesto como argumento después de `-F -` no es el mensaje: git lo toma como ruta.
- Node 22 en CI (`.nvmrc`); en local corre también con 24.
- Hay un PostgreSQL local (`DATABASE_URL` en `backend/.env`): la suite de integración corre en local contra `<base>_test`.
- Trampas conocidas al validar (cobertura distinta por el `.env` local, un test que se cae solo en Windows, `npm audit` intermitente): `docs/runbooks/validar-ci.md`.
