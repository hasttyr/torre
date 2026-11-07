# Plan de pruebas — Torre Central Hub

Sistema de gestión de torneos de ajedrez universitarios · Práctica de Ingeniería IV · Universidad Central, Facultad de Ingeniería y Ciencias Básicas

| Campo   | Valor                        |
| ------- | ---------------------------- |
| Versión | 2.1                          |
| Fecha   | 6 de noviembre de 2026       |
| Autor   | Nilson Aldair Molina Rengifo |
| Estado  | Ejecutado, salvo la UAT P35  |

## Contenido

1. [Introducción](#1-introducción)
2. [Resumen ejecutivo](#2-resumen-ejecutivo)
3. [Historial de versiones](#3-historial-de-versiones)
4. [Información del proyecto](#4-información-del-proyecto)
5. [Alcance de las pruebas](#5-alcance-de-las-pruebas)
6. [Elementos de las pruebas](#6-elementos-de-las-pruebas)
   - 6.1 [Componentes de la plataforma a probar](#61-componentes-de-la-plataforma-a-probar)
7. [Funcionalidades a probar](#7-funcionalidades-a-probar)
8. [Diseño de casos de prueba](#8-diseño-de-casos-de-prueba)
   - 8.1 [Pruebas unitarias](#81-pruebas-unitarias)
     - 8.1.1 [Pruebas de caja negra](#811-pruebas-de-caja-negra)
   - 8.2 [Pruebas de integración](#82-pruebas-de-integración)
   - 8.3 [Pruebas de sistema](#83-pruebas-de-sistema)
   - 8.4 [Pruebas de aceptación](#84-pruebas-de-aceptación)
   - 8.5 [Todos los tipos de prueba, con un comando](#85-todos-los-tipos-de-prueba-con-un-comando)
9. [Ejecución de casos de prueba](#9-ejecución-de-casos-de-prueba)
10. [Criterios de aceptación](#10-criterios-de-aceptación)
11. [Criterios de suspensión](#11-criterios-de-suspensión)
12. [Criterios de reanudación](#12-criterios-de-reanudación)
13. [Recursos](#13-recursos)
    - 13.1 [Recursos de hardware y software](#131-recursos-de-hardware-y-software)
    - 13.2 [Herramientas de pruebas](#132-herramientas-de-pruebas)
    - 13.3 [Recursos de personal](#133-recursos-de-personal)
    - 13.4 [Recursos de entrenamiento](#134-recursos-de-entrenamiento)
14. [Manual de usuario](#14-manual-de-usuario)
15. [Análisis y conclusiones](#15-análisis-y-conclusiones)

## 1. Introducción

Este documento define cómo se verifica y se valida Torre Central Hub. Para cada nivel (unitario, integración, sistema y aceptación) dice qué se prueba, con qué casos y con qué criterio se aprueba. También registra el resultado de la ejecución.

Parte del plan textual del documento de sustentación (casos P01–P35, requerimientos RF01–RF23, reglas RN-01 a RN-11 y requerimientos no funcionales RNF01–RNF08). Cada caso apunta a la prueba automática o al procedimiento manual que lo comprueba, así que cualquier resultado de este documento se puede repetir con un comando. Todas las suites automáticas, de todos los tipos, corren juntas con `npm test` desde la raíz del repositorio (sección 8.5).

Documentos relacionados:

| Documento                                                  | Para qué                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| [`runbooks/regresion.md`](runbooks/regresion.md)           | La regresión P01–P33 (P34) caso por caso, con sus ajustes |
| [`runbooks/ensayo-uat.md`](runbooks/ensayo-uat.md)         | El ensayo de la UAT con incidentes de un día de torneo    |
| [`entrega/acta-uat-p35.md`](entrega/acta-uat-p35.md)       | El acta de aceptación P35, para llenar y firmar           |
| [`runbooks/validar-ci.md`](runbooks/validar-ci.md)         | Cómo correr todas las compuertas como el CI               |
| [`architecture.md`](architecture.md#estrategia-de-pruebas) | La estrategia de pruebas dentro de la arquitectura        |
| [`manual-de-usuario.md`](manual-de-usuario.md)             | El manual de usuario por rol (sección 14)                 |

## 2. Resumen ejecutivo

- **Qué se probó:** las 23 funcionalidades del documento de sustentación, más las que se agregaron en la Fase 5 (sala pública, avisos de ronda, autoinscripción, incomparecencias, reapertura de inscripciones), en cuatro niveles.
- **Cómo:** 1.572 pruebas automáticas en cada commit:
  - backend: 635 unitarias y 109 de integración contra PostgreSQL real;
  - frontend: 815 de componentes, vistas y contratos;
  - e2e: 13 escenarios de navegador contra la API real.

  A eso se suman las revisiones manuales del PDF contra la sala y del ambiente de producción.

- **Y por tipo** (sección 8.5), con `npm test` desde la raíz: humo (6), usabilidad y accesibilidad WCAG 2.1 AA (19), seguridad desde fuera (27), compatibilidad en Firefox, WebKit, Android e iPhone (40), recuperación en el navegador (4) y, en el servidor, instalación desde cero, carga, estrés, resistencia y recuperación ante caídas de la API y de la base (29 comprobaciones).

- **Resultado:** todo en verde. La cobertura del backend es 96,6 % de sentencias y 90,2 % de ramas; la del frontend, 94,2 % y 89,1 %. Los 31 casos funcionales P01–P33 dan el resultado esperado, y la regresión (P34) no encontró regresiones.
- **Rendimiento:** con 50 usuarios virtuales sin pausa, unas 1.100 peticiones por segundo con p95 de 79 ms y ningún error; la API deja de dar abasto hacia los 800 usuarios simultáneos y se recupera sola; 5 minutos de carga sostenida sin degradación ni crecimiento de memoria.
- **Fallos encontrados por las pruebas de este plan:** cuatro, todos corregidos con su prueba:
  - la fecha de fin vacía al recargar la configuración;
  - una fecha de nacimiento del 1 de enero de 1900 rechazada en Colombia;
  - la edad de un jugador sumaba un año el día antes de su cumpleaños;
  - el botón de idioma y el menú de usuario no se llamaban como lo que muestran (WCAG 2.5.3).

  Ver la sección 9.

- **Pendiente:** la prueba de aceptación P35, que necesita al organizador, al árbitro y a los estudiantes. El acta y el guion están listos.

## 3. Historial de versiones

| Versión | Fecha                  | Cambio                                                                                                                                                                                                       | Referencia                                 |
| ------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| 1.0     | Agosto de 2026         | Plan textual P01–P35 y criterios de salida, en el documento de sustentación                                                                                                                                  | `git show ffca031~1:docs/DOCUMENTACION.md` |
| 1.1     | 22 de octubre de 2026  | Regresión P01–P33 con el resultado esperado ajustado a lo implementado y la prueba que comprueba cada caso                                                                                                   | `docs/runbooks/regresion.md` (3c9c85d)     |
| 1.2     | 5 de noviembre de 2026 | Ejecución de la regresión (#113), guion del ensayo de la UAT (#131) y acta P35 (#114)                                                                                                                        | ad0e8ce, d4084c5, 84042c3                  |
| 2.0     | 5 de noviembre de 2026 | Este documento: plan completo por niveles, casos de caja negra con su prueba, manual de usuario validado y ejecución con cifras                                                                              | 7c2c5ad                                    |
| 2.1     | 6 de noviembre de 2026 | Todos los tipos de prueba con su suite y un comando único (`npm test`): humo, cordura, usabilidad, seguridad, compatibilidad, instalación, carga, estrés, resistencia y recuperación; clasificación por caja | Este cambio                                |

## 4. Información del proyecto

| Campo           | Valor                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Proyecto        | Torre Central Hub                                                                                          |
| Institución     | Universidad Central, Facultad de Ingeniería y Ciencias Básicas                                             |
| Asignatura      | Práctica de Ingeniería IV                                                                                  |
| Autor           | Nilson Aldair Molina Rengifo                                                                               |
| Metodología     | Scrum adaptado: 14 semanas (2 de levantamiento, 2 de diseño, 9 incrementos de una semana, 1 de validación) |
| Repositorio     | `https://github.com/hasttyr/torre` (rama `main`)                                                           |
| Aplicación      | `https://torre-roan.vercel.app` (Vercel)                                                                   |
| API             | `https://torre-be.onrender.com` (Render, con PostgreSQL)                                                   |
| Usuarios        | Organizador, árbitro, jugador, entrenador y administrador de los torneos de ajedrez de la universidad      |
| Marco normativo | Ley 1581 de 2012 (datos personales); reglamentos de FIDE para sistema suizo y desempates                   |

## 5. Alcance de las pruebas

**Dentro del alcance:**

- Las funcionalidades RF01–RF23 y las reglas RN-01 a RN-11 (sección 7).
- Las funcionalidades agregadas en la Fase 5:
  - autoinscripción del jugador;
  - reapertura de inscripciones;
  - incomparecencias;
  - listado y sala públicos;
  - revancha autorizada;
  - avisos de ronda por correo;
  - cierre automático por fecha.
- Requerimientos no funcionales que se pueden verificar con una prueba: seguridad (RNF01), integridad transaccional (RNF02), rendimiento (RNF03), disponibilidad para usuarios autorizados (RNF04), mantenibilidad (RNF05), capacidad y estabilidad sostenida (RNF06), usabilidad por rol (RNF07) y trazabilidad (RNF08).
- Recuperación ante caídas, compatibilidad con otros navegadores y teléfonos, e instalación desde cero (sección 8.5).
- El ambiente de producción, además del local y del CI.

**Fuera del alcance:**

| Qué                                             | Por qué                                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Cálculo de rating y desempate ARO               | Fuera del alcance del producto: ARO necesita ratings (README, "Decisiones de alcance")                                                      |
| Conformidad completa con FIDE C.04.3            | El motor es un Dutch simplificado a propósito ([decisión 014](decisions/014-motor-suizo-simplificado.md)); se prueban sus reglas, no C.04.3 |
| Envío real de correo en producción              | Producción no tiene proveedor de correo (#130); el envío se prueba con un transporte simulado                                               |
| Carga, estrés y resistencia en producción       | Se miden en local contra la API real (sección 8.5): sobre el plan gratuito de Render solo medirían ese plan, y lo saturarían para todos     |
| Los flujos que cambian datos, en cada navegador | En Firefox, WebKit y los teléfonos corren el humo y los flujos de solo lectura; los que cambian datos, en Chromium (sección 8.5)            |

## 6. Elementos de las pruebas

| Elemento               | Qué se prueba                                                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Código                 | La rama `main` del repositorio, en cada commit (CI)                                                                                                                                                                           |
| Versión ejecutada      | La de la sección 9                                                                                                                                                                                                            |
| Ambiente local         | Windows 11, Node 26, PostgreSQL 18 (base `<base>_test` para la integración)                                                                                                                                                   |
| Ambiente de CI         | GitHub Actions, Ubuntu, Node 22 (`.nvmrc`), PostgreSQL 16 como servicio                                                                                                                                                       |
| Ambiente de producción | Vercel (aplicación) y Render (API y PostgreSQL)                                                                                                                                                                               |
| Datos de prueba        | Las fábricas de cada prueba (`backend/src/testing/testDatabase.ts`) y el seed (`backend/prisma/seed.ts`): una cuenta por rol, 12 jugadores, clubes, cinco torneos finalizados y uno en curso. Ningún dato real de estudiantes |
| Contrato de la API     | `backend/src/contracts/`, compilado por los dos proyectos: un cambio que un lado no conoce no compila                                                                                                                         |

### 6.1 Componentes de la plataforma a probar

| Componente                    | Ubicación                                                  | Cómo se prueba                                                                                   |
| ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Validación de entradas        | `backend/src/validators/`                                  | Unitarias de caja negra (8.1.1) y de límites (`bounds.test.ts`)                                  |
| Motor de emparejamiento suizo | `backend/src/services/pairing/`                            | Unitarias de caja negra sobre funciones puras (`swissPairing.test.ts`)                           |
| Cálculo de clasificación      | `backend/src/services/standings.calculator.ts`             | Unitarias de caja negra (`standings.calculator.test.ts`)                                         |
| Servicios de dominio          | `backend/src/services/`                                    | Unitarias con Prisma simulado; integración contra PostgreSQL para SQL, transacciones y carreras  |
| API REST y permisos           | `backend/src/routes/`, `middlewares/`                      | Supertest por ruta (código de estado, rol, cuerpo); integración de punta a punta                 |
| Sesión y seguridad            | `middlewares/auth.ts`, `sessionCookie.ts`, `rateLimits.ts` | Unitarias y de integración; e2e de sesión; cabeceras en `deployment.test.ts`                     |
| Tiempo real                   | `backend/src/sockets/`                                     | Integración con Socket.IO real (`sockets.int.test.ts`)                                           |
| Documentos PDF                | `backend/src/services/exports/`                            | Unitarias del contenido; revisión manual contra la sala (P32)                                    |
| Base de datos                 | `backend/prisma/` (esquema, migraciones, `CHECK`)          | Integración: restricciones y migraciones aplicadas sobre la base de prueba                       |
| Interfaz                      | `frontend/src/views/`, `components/`                       | Vue Test Utils con el i18n real; e2e en Chromium                                                 |
| Textos e idiomas              | `frontend/src/i18n/`                                       | `locales.test.ts` (español e inglés completos), `contracts.test.ts` (cada catálogo con su texto) |
| Configuración de despliegue   | `frontend/vercel.json`, `.env.production`                  | `deployment.test.ts` (CSP, cabeceras, reescrituras); verificación manual en producción           |
| Manual de usuario             | `docs/manual-de-usuario.md`                                | `frontend/src/manual.test.ts`: cada texto y ruta citados existen en la aplicación                |

## 7. Funcionalidades a probar

| RF   | Funcionalidad                                                                                            | Reglas              | Casos                     | Nivel principal       |
| ---- | -------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------- | --------------------- |
| RF01 | Crear cuentas de usuario por rol                                                                         | RN-10               | P01, CB-01–07             | Unitario, integración |
| RF02 | Autenticar usuarios y controlar acceso                                                                   | —                   | P02, CB-08                | Integración, sistema  |
| RF03 | Gestionar permisos por rol                                                                               | RN-11               | P03                       | Integración           |
| RF04 | Crear y configurar torneos                                                                               | RN-05               | P04, P05, CB-10–13        | Unitario, integración |
| RF05 | Registrar jugadores en torneo                                                                            | RN-01               | P06, P07                  | Integración, sistema  |
| RF06 | Generar emparejamientos suizos                                                                           | RN-02, RN-07, RN-08 | P08, P09, CB-17, CB-22–26 | Unitario              |
| RF07 | Registrar resultados                                                                                     | RN-03, RN-06        | P10, P11, CB-14–15        | Unitario, integración |
| RF08 | Calcular clasificación                                                                                   | RN-04               | P12, P14, CB-27           | Unitario              |
| RF09 | Aplicar desempates                                                                                       | RN-05               | P13, CB-28–31             | Unitario              |
| RF10 | Consultar historial y estadísticas                                                                       | —                   | P15, P16                  | Unitario              |
| RF11 | Recuperar acceso                                                                                         | —                   | P21, CB-09                | Integración           |
| RF12 | Editar perfil propio                                                                                     | —                   | P22, CB-18                | Integración           |
| RF13 | Registrar consentimiento                                                                                 | RN-10               | P23, CB-07                | Unitario, integración |
| RF14 | Derechos sobre datos personales                                                                          | —                   | P24                       | Integración           |
| RF15 | Gestionar clubes                                                                                         | —                   | P25, CB-19                | Unitario              |
| RF16 | Vincular jugador y entrenador                                                                            | —                   | P26                       | Integración, sistema  |
| RF17 | Listado público de torneos                                                                               | —                   | P27                       | Integración, sistema  |
| RF18 | Torneos del organizador                                                                                  | —                   | P28                       | Unitario              |
| RF19 | Retirar jugador                                                                                          | RN-07, RN-11        | P29                       | Unitario, integración |
| RF20 | Bye automático                                                                                           | RN-08               | P30, CB-24                | Unitario              |
| RF21 | Ajuste manual de emparejamiento                                                                          | RN-09, RN-11        | P31, CB-16                | Unitario              |
| RF22 | Exportar PDF                                                                                             | —                   | P32                       | Unitario y manual     |
| RF23 | Bitácora de auditoría                                                                                    | RN-11               | P33                       | Unitario, integración |
| F5   | Sala pública, avisos de ronda, autoinscripción, incomparecencias, reapertura, revancha, cierre por fecha | RN-02, RN-03        | CI-17–CI-22, E2E          | Integración, sistema  |

## 8. Diseño de casos de prueba

### 8.1 Pruebas unitarias

Prueban una pieza aislada, sin red ni base de datos: el backend con un Prisma simulado, y el frontend montando cada componente con su i18n real. Viven junto al archivo que prueban (`x.ts` → `x.test.ts`) y corren en cada commit.

| Proyecto | Qué cubren                                                                       | Archivos | Pruebas | Comando                         |
| -------- | -------------------------------------------------------------------------------- | -------- | ------- | ------------------------------- |
| Backend  | Validadores, motor suizo, cálculo de clasificación, servicios, rutas (Supertest) | 62       | 635     | `npx vitest run --project unit` |
| Frontend | Vistas, componentes, consultas, servicios HTTP, i18n, despliegue y manual        | 90       | 815     | `npm test`                      |

Las pruebas unitarias corren en la hora de Colombia (`backend/vitest.setup.ts`): así, una fecha leída con la zona horaria del servidor falla también en el CI, que corre en UTC.

#### 8.1.1 Pruebas de caja negra

Se diseñaron desde el requerimiento, sin mirar el código, con dos técnicas:

- **Partición de equivalencia:** una clase válida y las inválidas de cada entrada.
- **Análisis de valores límite:** el mínimo y el máximo, y un valor a cada lado de ellos.

Cada caso es una fila de `backend/src/validators/blackBox.test.ts` con el mismo identificador, y cada clase o límite es una prueba (85 en total). Los casos sobre lógica pura (CB-22 en adelante) apuntan a la prueba que ya los cubría.

**Entradas (validación de peticiones):**

| ID    | Requisito   | Entrada                      | Clases válidas                                                      | Clases inválidas y límites                                             |
| ----- | ----------- | ---------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| CB-01 | RF01        | Nombre                       | 2 caracteres (límite); 100 caracteres (límite)                      | 1 carácter; 101 caracteres; solo espacios                              |
| CB-02 | RF01        | Correo                       | Formato `usuario@dominio`                                           | Sin `@`; vacío                                                         |
| CB-03 | RF01        | Contraseña                   | 8 caracteres (límite); 128 (límite)                                 | 7 caracteres; 129 caracteres                                           |
| CB-04 | RF01, RF03  | Rol de autoservicio          | Jugador (con datos académicos); entrenador                          | Organizador, árbitro y administrador: solo los asigna un administrador |
| CB-05 | RF01        | Datos de jugador             | Código, programa y semestre presentes                               | Falta el código; falta el programa; falta el semestre                  |
| CB-06 | RF01        | Semestre                     | 1 (límite); 20 (límite)                                             | 0; 21; 3,5 (no entero)                                                 |
| CB-07 | RF13, RN-10 | Aceptación de la política    | Aceptada                                                            | No aceptada; omitida                                                   |
| CB-08 | RF02        | Credenciales                 | Correo y contraseña con formato válido                              | Contraseña vacía; correo inválido                                      |
| CB-09 | RF11        | Restablecer contraseña       | Token y contraseña de 8 caracteres                                  | Contraseña de 7; token vacío                                           |
| CB-10 | RF04        | Fechas y nombre del torneo   | Fin igual al inicio (límite); fin después del inicio                | Fin antes del inicio; una fecha que no es fecha; sin nombre            |
| CB-11 | RF04        | Número de rondas             | 1 (límite); 50 (límite)                                             | 0; 51; 2,5                                                             |
| CB-12 | RF20, HU28  | Valor del bye                | 0; 0,5; 1                                                           | 0,25; 2                                                                |
| CB-13 | RF09, RN-05 | Orden de desempates          | Criterios del catálogo en posiciones distintas; posición 5 (límite) | Criterio fuera del catálogo; criterio repetido; posición 0             |
| CB-14 | RF07, RN-03 | Resultado de una partida     | `1-0`, `0-1`, `1/2-1/2`, `1F-0F`, `0F-1F`, `0F-0F`                  | `BYE` (solo lo asigna el motor); `2-0`; vacío                          |
| CB-15 | RF07, HU11  | Motivo de una corrección     | Omitido (es opcional); 500 caracteres (límite)                      | Solo espacios; 501 caracteres                                          |
| CB-16 | RF21, RN-09 | Ajuste manual                | Motivo de 3 caracteres (límite)                                     | Sin motivo; motivo de 2 caracteres; jugador sin id válido              |
| CB-17 | RF06, RN-02 | Revancha autorizada          | Ronda normal sin cuerpo; revancha con motivo                        | Revancha sin motivo                                                    |
| CB-18 | RF12        | Fecha de nacimiento y género | 1 de enero de 1900 (límite); borrar el género (dato opcional)       | 31 de diciembre de 1899; fecha futura; género fuera del catálogo       |
| CB-19 | RF15        | Nombre del club              | 2 caracteres (límite)                                               | 1 carácter                                                             |
| CB-20 | #141        | Aviso de ronda               | Sí o no                                                             | Un texto ("si")                                                        |
| CB-21 | RNF01       | Identificador en la URL      | Un UUID                                                             | Un texto que no es UUID (`../users`)                                   |

Los máximos de todos los textos y números de la API se prueban además en `validators/bounds.test.ts`.

**Lógica pura (emparejamiento y clasificación):**

| ID    | Requisito   | Entrada                                                  | Resultado esperado                                                       | Prueba                                                                                                                                   |
| ----- | ----------- | -------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| CB-22 | RF06        | Ronda 1 con 4 jugadores                                  | La mitad superior juega contra la inferior, con colores alternados       | `swissPairing.test.ts` › "round 1: top half meets bottom half, alternating colors down the boards"                                       |
| CB-23 | RF06, RN-02 | Jugadores que ya se enfrentaron                          | No se repite el enfrentamiento                                           | `swissPairing.test.ts` › "never repeats a previous game (RN-02)"                                                                         |
| CB-24 | RF20, RN-08 | Número impar de jugadores                                | Bye al de menor puntaje que no lo haya tenido                            | `swissPairing.test.ts` › "gives the bye to the lowest-ranked player who hasn't had one (RN-08)"                                          |
| CB-25 | RF06, RN-02 | Todas las parejas posibles repiten                       | Se informa que es imposible; con revancha autorizada, repite las mínimas | `swissPairing.test.ts` › "reports when every option would repeat a game" y "repeats only the games it must, keeping the rest new"        |
| CB-26 | RF06        | Un campo jugado ronda tras ronda                         | Nunca repite un enfrentamiento en todo el torneo                         | `swissPairing.test.ts` › "pairs a full round-robin-sized field over several rounds without ever repeating"                               |
| CB-27 | RF08, RN-03 | Cada valor del catálogo de resultados                    | Los puntos de cada lado; un valor fuera del catálogo se rechaza          | `standings.calculator.test.ts` › "maps every RN-03 result value to each side's points" y "rejects values outside the catalog"            |
| CB-28 | RF09        | Partidas de un torneo                                    | Puntaje, Buchholz, Buchholz Cortado 1 y Sonneborn-Berger correctos       | `standings.calculator.test.ts` › "computes score, Buchholz, Buchholz Cut 1 and Sonneborn-Berger"                                         |
| CB-29 | RF09, RN-05 | Empate en puntos con desempates configurados             | Ordena por los desempates en el orden configurado; ARO se omite          | `standings.calculator.test.ts` › "orders by score, then by the tournament's tiebreaks in their configured order"                         |
| CB-30 | RF09        | Empate que ningún desempate resuelve, en cualquier orden | Puesto compartido (1, 1, 3)                                              | `standings.calculator.test.ts` › "is a shared place, and the next player counts the places taken" y "whatever order the players came in" |
| CB-31 | RF09        | Ciclo de resultados particulares (A>B, B>C, C>A)         | El resultado particular no rompe el empate                               | `standings.calculator.test.ts` › "includes a cycle of direct encounters: A beat B, B beat C, C beat A"                                   |

### 8.2 Pruebas de integración

Prueban varias piezas juntas contra PostgreSQL real: la API con sus rutas, servicios, transacciones, restricciones de la base y Socket.IO. Solo la base puede probar lo que se prueba aquí: SQL, restricciones `CHECK`, bloqueos y carreras entre peticiones simultáneas. Corren con `npm run test:integration` en el backend (14 archivos, 109 pruebas), sobre una base `<base>_test` que se migra al empezar y se vacía antes de cada prueba.

| ID    | Requisito    | Escenario                                                                                                     | Resultado esperado                                                                                                                                               | Prueba                                  |
| ----- | ------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| CI-01 | RF01, RF02   | Registrar un jugador, iniciar sesión y leer el perfil propio; registrar el mismo correo dos veces             | La cuenta se crea y la sesión funciona; el segundo registro se rechaza                                                                                           | `auth.int.test.ts`                      |
| CI-02 | RF02, RNF01  | Iniciar sesión                                                                                                | Sesión en una cookie que los scripts no pueden leer, sin token en la respuesta                                                                                   | `auth.int.test.ts`                      |
| CI-03 | RF03, RF11   | Restablecer la contraseña, cerrar sesión, cambiar el rol o bloquear la cuenta                                 | Las sesiones anteriores dejan de valer                                                                                                                           | `auth.int.test.ts`                      |
| CI-04 | RF11         | Dos confirmaciones simultáneas con el mismo enlace; usar un enlace después de otro                            | Solo una cambia la contraseña; un enlace usado anula los demás                                                                                                   | `auth.int.test.ts`                      |
| CI-05 | RF03         | El único administrador intenta quitarse el rol; dos administradores se lo quitan a la vez                     | Siempre queda un administrador activo                                                                                                                            | `users.int.test.ts`                     |
| CI-06 | RF05, RN-01  | Una inscripción llega mientras se cierran las inscripciones; se cierran dos veces a la vez                    | La inscripción se rechaza; el cierre ocurre una vez                                                                                                              | `tournaments.int.test.ts`               |
| CI-07 | RF04, RN-05  | Guardar el orden de desempates; una posición repetida; un criterio fuera del catálogo escrito en la base      | Se guarda; 400; la base lo rechaza                                                                                                                               | `tournaments.int.test.ts`               |
| CI-08 | RN-05        | Cambiar el orden de desempates mientras aparece la ronda 1                                                    | Se rechaza                                                                                                                                                       | `tournaments.int.test.ts`               |
| CI-09 | RF06         | Generar la misma ronda dos veces a la vez; publicar mientras el torneo termina                                | Se empareja una vez; la publicación se rechaza                                                                                                                   | `tournaments.int.test.ts`               |
| CI-10 | RF07, RF08   | Dos resultados registrados en el mismo instante; un resultado en un torneo que termina a mitad de la petición | Los dos llegan a la clasificación; el segundo se rechaza                                                                                                         | `tournaments.int.test.ts`               |
| CI-11 | RF07, RN-03  | Una incomparecencia                                                                                           | Suma el punto a quien se presentó, no cuenta para Buchholz y los dos pueden volver a enfrentarse                                                                 | `tournaments.int.test.ts`               |
| CI-12 | RF14         | Supresión, acceso y rectificación de datos (Ley 1581)                                                         | La supresión borra la cuenta y su nombre en la bitácora, y se bloquea si un torneo activo la necesita; el acceso entrega todo; la rectificación queda registrada | `dataRights.int.test.ts`                |
| CI-13 | RF16, HU24   | El entrenador busca y pide seguir a un jugador                                                                | Sin correos en la respuesta; sin barrer el directorio por fragmentos; solo el nombre hasta que el jugador acepta                                                 | `privacy.int.test.ts`                   |
| CI-14 | RF15         | Leer la plantilla de un club                                                                                  | Solo quien administra clubes                                                                                                                                     | `privacy.int.test.ts`                   |
| CI-15 | RF09, RNF04  | Eventos en vivo de un torneo                                                                                  | Llegan a quien lo sigue; un borrador solo a quien lo administra; una conexión no entra a salas sin límite                                                        | `sockets.int.test.ts`                   |
| CI-16 | RNF01        | Límites de inicio de sesión entre dos instancias de la API                                                    | El intento 11 fallido se rechaza aunque llegue a otra instancia                                                                                                  | `rateLimitStore.int.test.ts`            |
| CI-17 | Decisión 010 | Un torneo en curso pasa su fecha de fin                                                                       | Se cierra solo con lo jugado, en la hora de Bogotá, y lo registra en la bitácora                                                                                 | `autoFinish.int.test.ts`                |
| CI-18 | RN-03        | La restricción `CHECK` del catálogo de resultados                                                             | Admite cada resultado e incomparecencia, y nada más                                                                                                              | `autoFinish.int.test.ts`                |
| CI-19 | #140, RNF01  | La sala pública sin sesión                                                                                    | Solo nombres y cifras: ni correo, programa, género, discapacidad ni ids; sin rondas en borrador; 404 para un torneo sin rondas; `noindex`                        | `publicRoom.int.test.ts`                |
| CI-20 | #141         | Se publica una ronda                                                                                          | El aviso llega solo a los jugadores no retirados, activos y que no lo desactivaron                                                                               | `roundNotices.int.test.ts`              |
| CI-21 | Operación    | Crear la base de un despliegue nuevo, dos veces                                                               | Crea el catálogo de roles y un administrador; la segunda vez no duplica nada                                                                                     | `bootstrap.int.test.ts`                 |
| CI-22 | RF23, RF14   | Migrar entradas viejas de la bitácora                                                                         | Cada nombre queda ligado a su persona; una supresión posterior lo oculta                                                                                         | `migrateLegacyAuditDetails.int.test.ts` |

### 8.3 Pruebas de sistema

Prueban el sistema completo como lo usa una persona: la aplicación en un navegador, contra la API real y su base. Comprenden:

1. **Los casos funcionales P01–P33** del documento de sustentación, con su resultado esperado ajustado a lo implementado. La tabla completa, con la prueba que comprueba cada caso, está en [`runbooks/regresion.md`](runbooks/regresion.md#casos). Resumen:

| Caso | Funcionalidad                 | Resultado esperado (resumido)                                                                                     |
| ---- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| P01  | Registrar usuario             | Cuenta creada con rol de autoservicio; correo repetido, 409                                                       |
| P02  | Autenticar                    | Sesión en cookie `HttpOnly`; credenciales incorrectas, 401                                                        |
| P03  | Gestionar permisos            | El administrador cambia roles y las sesiones con el rol anterior caducan; un rol sin permiso, 403                 |
| P04  | Crear torneo                  | Queda en estado preliminar; sin datos obligatorios, 400                                                           |
| P05  | Configurar torneo             | Se guarda; desde la ronda 1 el orden de desempates y el bye no cambian                                            |
| P06  | Abrir y cerrar inscripciones  | Solo se inscribe con inscripciones abiertas; si no, 409                                                           |
| P07  | Registrar jugador             | La segunda inscripción del mismo jugador activo, 409                                                              |
| P08  | Generar emparejamiento        | Borrador sin enfrentamientos repetidos; en otro estado, rechazo                                                   |
| P09  | Publicar emparejamientos      | Visible para todos y evento `pairing.published`; inexistente, 404; dos veces, 409                                 |
| P10  | Registrar resultado           | Resultado del catálogo guardado, clasificación recalculada y evento; fuera del catálogo, 400                      |
| P11  | Corregir resultado            | Árbitro, organizador o administrador corrigen, con registro en la bitácora; un jugador, 403                       |
| P12  | Recalcular clasificación      | Reconstruida desde las partidas oficiales; pendiente mientras falten resultados; empates sin resolver compartidos |
| P13  | Aplicar desempates            | Buchholz, Buchholz Cortado 1, Sonneborn-Berger y resultado particular, en el orden configurado; ARO se omite      |
| P14  | Publicar clasificación        | La sala muestra posiciones y desempates en tiempo real                                                            |
| P15  | Consultar historial           | Torneos y partidas del jugador; sin registros, un mensaje                                                         |
| P16  | Consultar estadísticas        | Solo con rondas publicadas, visibles con sesión                                                                   |
| P17  | Finalizar torneo              | Finalizado y sin cambios; si falta algo, 409                                                                      |
| P18  | Consulta por rol              | Cada rol ve solo lo permitido; la sala se actualiza en vivo                                                       |
| P21  | Recuperar acceso              | Enlace de un solo uso que vence en una hora; respuesta genérica para un correo no registrado                      |
| P22  | Editar perfil                 | Solo los datos propios                                                                                            |
| P23  | Registrar consentimiento      | Sin aceptar, 400; aceptando, se guardan fecha y versión                                                           |
| P24  | Derechos sobre datos          | Rectificación aplicada; supresión bloqueada mientras un torneo activo la necesite                                 |
| P25  | Gestionar clubes              | Club guardado y visible en el perfil del jugador                                                                  |
| P26  | Vincular jugador y entrenador | Pendiente hasta que el jugador acepta; otro rol, 403                                                              |
| P27  | Torneos disponibles           | Solo los de inscripción abierta                                                                                   |
| P28  | Mis torneos                   | El organizador ve los suyos; el administrador, todos                                                              |
| P29  | Retirar jugador               | No se empareja más; sus resultados previos quedan marcados                                                        |
| P30  | Bye automático                | Al de menor puntaje sin bye previo, con el valor configurado                                                      |
| P31  | Ajuste manual                 | Intercambio con motivo obligatorio, en la bitácora                                                                |
| P32  | Exportar PDF                  | Coincide con la información oficial, con fecha y hora de generación                                               |
| P33  | Bitácora                      | El administrador la consulta paginada; otro rol, 403                                                              |

2. **Los escenarios de navegador (e2e)**, con Playwright en Chromium contra la API real y una base propia sembrada con el seed (`npm run test:e2e` en el frontend):

| ID     | Escenario                                                                                                        | Casos que cubre      | Archivo                     |
| ------ | ---------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------- |
| E2E-01 | Cada uno de los 5 roles inicia sesión y ve los enlaces de su rol                                                 | P02, P03, P18, RNF07 | `roles.spec.ts` (5 pruebas) |
| E2E-02 | La sesión es una cookie que los scripts de la página no pueden leer                                              | P02, RNF01           | `session.spec.ts`           |
| E2E-03 | Cerrar sesión la termina en el servidor, no solo en el navegador                                                 | P02, RNF01           | `session.spec.ts`           |
| E2E-04 | El organizador publica la ronda 1, el árbitro registra un resultado y la sala lo muestra en vivo                 | P08–P10, P14, P18    | `tournament.spec.ts`        |
| E2E-05 | Un entrenador sigue a un jugador solo cuando el jugador acepta                                                   | P26, P18             | `coachConsent.spec.ts`      |
| E2E-06 | Un jugador se inscribe solo y el organizador lo ve en la lista                                                   | P07, P27             | `selfEnrollment.spec.ts`    |
| E2E-07 | Un visitante ve los torneos abiertos sin iniciar sesión                                                          | P27                  | `publicTournaments.spec.ts` |
| E2E-08 | Un visitante sigue la sala pública de un torneo terminado, solo con nombres y resultados                         | #140                 | `publicTournaments.spec.ts` |
| E2E-09 | Un día de torneo con sus incidentes: llegada tarde, autoinscripción, incomparecencia, fecha extendida, "tu mesa" | P05–P11, P29         | `uatRehearsal.spec.ts`      |

3. **Requerimientos no funcionales:**

| ID    | RNF   | Qué se verifica                                                                                          | Cómo                                                                                                                    |
| ----- | ----- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| NF-01 | RNF01 | Cada ruta exige sesión y rol; el servicio revisa el recurso concreto; límites de intentos                | `*.routes.test.ts`, `middlewares/auth.test.ts`, `rateLimits`, CI-16                                                     |
| NF-02 | RNF01 | Política de seguridad de contenido sin scripts en línea, HSTS, `X-Frame-Options`, `nosniff`              | `deployment.test.ts`; revisión en producción (sección 9)                                                                |
| NF-03 | RNF01 | Dependencias sin vulnerabilidades altas                                                                  | `npm audit --audit-level=high` en el CI                                                                                 |
| NF-04 | RNF02 | Cambios a un torneo serializados por bloqueo; sin resultados perdidos ante peticiones simultáneas        | CI-06 a CI-10 (carreras con `raceWithChange`)                                                                           |
| NF-05 | RNF03 | Tiempo de respuesta de la API en producción                                                              | Muestra de 15 peticiones por ruta (sección 9)                                                                           |
| NF-06 | RNF04 | Lo publicado está disponible para cada rol, también sin sesión donde corresponde                         | P18, CI-15, CI-19                                                                                                       |
| NF-07 | RNF05 | El contrato de la API compila en los dos proyectos; lint, tipos y formato; la cobertura solo sube        | CI: `tsc`, `vue-tsc`, ESLint, Prettier, umbrales de cobertura ([decisión 008](decisions/008-la-cobertura-solo-sube.md)) |
| NF-08 | RNF07 | Cada rol ve su menú y su panel; textos completos en español e inglés                                     | E2E-01, `locales.test.ts`, `contracts.test.ts`                                                                          |
| NF-09 | RNF08 | Toda acción crítica queda en la bitácora con usuario, fecha y acción, sin guardar nombres en texto libre | Pruebas de servicios (`recordAuditLog`), CI-12, CI-22                                                                   |

### 8.4 Pruebas de aceptación

La prueba de aceptación de usuario (UAT, caso P35) la hacen las personas que van a usar el sistema, no el equipo. Responde si el sistema resuelve lo que necesitan como lo necesitan. Se hace en producción, con las cuentas del seed, en dos pasos:

1. **Ensayo** ([`runbooks/ensayo-uat.md`](runbooks/ensayo-uat.md), #131): un día de torneo con incidentes provocados, con un organizador que no sea del equipo, el árbitro y 2 o 3 estudiantes. Su mitad técnica ya está automatizada (E2E-09).
2. **Aceptación P35** ([`entrega/acta-uat-p35.md`](entrega/acta-uat-p35.md), #114): los actores ejecutan un torneo completo y el organizador firma el acta.

**Condiciones previas:** el CI en verde en el commit que se evalúa; el ensayo técnico en verde; las bases del torneo anuncian el emparejamiento suizo simplificado ([decisión 014](decisions/014-motor-suizo-simplificado.md)).

**Criterios de aceptación de la UAT:**

| ID    | Criterio                                                                                | Actor                |
| ----- | --------------------------------------------------------------------------------------- | -------------------- |
| CA-01 | Crea y configura el torneo (rondas, ritmo, desempates, bye, elegibilidad, fecha de fin) | Organizador          |
| CA-02 | Abre, cierra y, ante una llegada tarde, reabre inscripciones                            | Organizador          |
| CA-03 | Un jugador se inscribe solo; el organizador inscribe al resto                           | Jugador, organizador |
| CA-04 | Genera, revisa y publica una ronda; ajusta un emparejamiento con su motivo              | Organizador          |
| CA-05 | Cada jugador encuentra su mesa, color y rival en menos de un minuto, sin ayuda          | Jugadores            |
| CA-06 | Registra resultados e incomparecencias desde el celular; la sala se actualiza sola      | Árbitro              |
| CA-07 | Corrige un resultado con su motivo                                                      | Árbitro              |
| CA-08 | La clasificación aplica los desempates y muestra el puesto compartido si no se resuelve | Todos                |
| CA-09 | El PDF oficial coincide con la sala                                                     | Organizador          |
| CA-10 | Finaliza el torneo; el podio y el puesto de cada jugador se ven                         | Todos                |
| CA-11 | Un jugador descarga sus datos desde su cuenta (Ley 1581)                                | Jugador              |
| CA-12 | Recupera el acceso con el enlace por correo (requiere correo en producción, #130)       | Jugador              |

**Incidentes del ensayo**, para que la aceptación no apruebe sin probar nada: un jugador llega tarde, otro no se presenta, un resultado se anota mal y se corrige, el torneo se alarga y hay que extender la fecha de fin, y un empate en ciclo que ningún desempate resuelve.

**Regla de decisión:** se acepta si los criterios CA-01 a CA-11 pasan y no queda ningún hallazgo crítico ni alto que bloquee el flujo principal. CA-12 se puede omitir con su motivo mientras producción no tenga correo.

**Alfa y beta.** El ensayo técnico automático (E2E-09, `npm run test:acceptance`) y el ensayo con incidentes en el entorno del equipo son la prueba **alfa**. La aceptación P35, en producción y con los actores reales del torneo, es la prueba **beta**. La beta no se automatiza: lo que mide es si las personas pueden usar el sistema.

### 8.5 Todos los tipos de prueba, con un comando

Desde la raíz del repositorio, `npm test` corre todas las suites automáticas, una tras otra, y sigue aunque una falle. Al final imprime un resumen, lo guarda en `reports/resumen-pruebas.md` y sale con código 1 si alguna falló. Necesita lo mismo que el CI: PostgreSQL y `backend/.env` ([`runbooks/validar-ci.md`](runbooks/validar-ci.md)). La primera vez, `npm run setup` instala las dependencias de los dos proyectos y el Chromium de Playwright.

| Comando                      | Qué corre                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `npm test`                   | Todas las suites, salvo cordura y aceptación alfa (las dos ya están adentro) |
| `npm test -- security load`  | Solo esas suites o grupos                                                    |
| `npm run test:list`          | La lista de suites y grupos, con su nivel, tipo y caja                       |
| `npm run test:<suite>`       | Una suite (`test:smoke`, `test:security`, `test:stress`…)                    |
| `npm run test:regression`    | Regresión (P34): unitarias, integración, humo y sistema                      |
| `npm run test:functional`    | Las funcionales                                                              |
| `npm run test:nonfunctional` | Las no funcionales                                                           |
| `npm run test:performance`   | Carga, estrés y resistencia                                                  |

**1. Por nivel**, en el orden en que se ejecutan:

| Nivel       | Suite (`npm run test:…`)                    | Dónde                                                   |
| ----------- | ------------------------------------------- | ------------------------------------------------------- |
| Unitario    | `unit`, `coverage`                          | `*.test.ts` de los dos proyectos (sección 8.1)          |
| Integración | `integration`, `coverage`                   | `backend/src/**/*.int.test.ts` (sección 8.2)            |
| Sistema     | `smoke`, `system` y las no funcionales      | `frontend/e2e/`, `backend/src/testing/` (sección 8.3)   |
| Aceptación  | `acceptance` (alfa); P35 con usuarios, beta | `uatRehearsal.spec.ts`; `entrega/acta-uat-p35.md` (8.4) |

**2. Por objetivo.** Las funcionales responden si el sistema hace lo que debe; las no funcionales, qué tan bien lo hace.

| Tipo                       | Suite          | Qué comprueba                                                                                                                                                                                   | Archivo                                |
| -------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Humo                       | `smoke`        | La API responde por el origen de la app; la portada carga sin errores en la consola; se inicia sesión; una contraseña errada se rechaza; una página privada pide sesión; la ruta inexistente    | `e2e/smoke/smoke.spec.ts`              |
| Cordura                    | `sanity`       | Tras un cambio menor: solo las pruebas que dependen de los archivos cambiados (`vitest --changed`), y después el humo. Con `SANITY_BASE=main`, lo cambiado desde `main`                         | `scripts/test-all.mjs`                 |
| Regresión                  | `regression`   | Que lo que funcionaba siga funcionando: toda la suite funcional automática (P34)                                                                                                                | `runbooks/regresion.md`                |
| Interfaz y usabilidad      | `usability`    | WCAG 2.1 AA con axe en las pantallas públicas y en las de cada rol, en tema claro y oscuro; inicio de sesión solo con teclado; foco visible; sin desborde horizontal a 375 px; español e inglés | `e2e/usability/usability.spec.ts`      |
| Extremo a extremo          | `system`       | Los flujos completos de cada rol en el navegador, contra la API y la base reales (E2E-01 a E2E-09)                                                                                              | `e2e/*.spec.ts`                        |
| Rendimiento: carga         | `load`         | 50 usuarios virtuales sin pausa durante 30 s: todo 2xx, p95 ≤ 500 ms, p99 ≤ 1,5 s, al menos 50 peticiones por segundo                                                                           | `backend/src/testing/loadTest.ts`      |
| Rendimiento: estrés        | `stress`       | De 25 a 800 usuarios, 10 s por escalón: dónde deja de dar abasto (p95 > 1 s o más de 1 % de errores), que aguante al menos 100 y que se recupere sola al bajar la carga                         | `backend/src/testing/loadTest.ts`      |
| Rendimiento: resistencia   | `endurance`    | 30 usuarios durante 5 minutos (`ENDURANCE_MINUTES`): ningún error, el p95 final no pasa del doble del inicial y el montículo de memoria no crece más de 50 MB                                   | `backend/src/testing/loadTest.ts`      |
| Seguridad                  | `security`     | Ver NF-10                                                                                                                                                                                       | `e2e/security/security.spec.ts`        |
| Compatibilidad             | `compat`       | El humo, la sesión y las páginas públicas en Firefox, WebKit (el motor de Safari), un Android (Pixel 7) y un iPhone 14                                                                          | `playwright.config.ts`                 |
| Instalación/desinstalación | `installation` | En una base vacía: las 20 migraciones desde la primera, `bootstrap` con el primer administrador, la API arranca y se trabaja; redesplegar no cambia nada; desinstalar no deja rastro            | `backend/src/testing/installation.ts`  |
| Recuperación               | `recovery`     | Ver NF-14                                                                                                                                                                                       | `testing/recovery.ts`, `e2e/recovery/` |

Los usuarios virtuales de rendimiento piden una cosa tras otra, sin pausa: 50 de ellos son mucho más tráfico que 50 personas mirando la sala. Cada petición llega con una dirección propia (`X-Forwarded-For`, como detrás de Vercel), para medir la API y no los límites por dirección, que prueba la suite de seguridad.

**Los requerimientos no funcionales que agregan estas suites**, a continuación de NF-01 a NF-09 (sección 8.3):

| ID    | RNF          | Qué se verifica                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NF-10 | RNF01        | Desde fuera, como lo intentaría un atacante: cabeceras (CSP sin scripts en línea, marcos, `nosniff`, HSTS); CORS; cada ruta privada sin sesión, 401; cookie falsificada o alterada, 401; CSRF desde otro sitio, 403; mismo mensaje para cuenta inexistente y contraseña errada; 429 al intento 11; un jugador no llega a lo del organizador ni del administrador; asignación masiva en el perfil; inyección SQL; ids que no son UUID; cuerpos de 2 MB; XSS guardado en el nombre de un torneo; ningún correo ajeno en lo que descarga una página pública o la de un jugador |
| NF-11 | RNF03        | Carga y estrés (ver arriba)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| NF-12 | RNF06        | Resistencia (ver arriba)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| NF-13 | RNF07        | Usabilidad y accesibilidad (ver arriba)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| NF-14 | RNF02, RNF04 | Recuperación: la API muerta de golpe (sin apagado ordenado) vuelve en menos de 30 s, sin perder lo guardado y con las sesiones vigentes; si la base se cae, responde error y no datos falsos, el proceso sigue vivo y se reconecta sola cuando la base vuelve; en el navegador, la API caída o con 503 se muestra como fallo con "Reintentar", y una conexión que se corta no cierra la sesión                                                                                                                                                                              |
| NF-15 | RNF04        | Compatibilidad e instalación (ver arriba)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

**3. Por acceso al código:**

| Caja   | Qué sabe la prueba del interior                               | Suites                                                                                                                                                                                 |
| ------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blanca | La lógica y la estructura del código                          | `unit` (servicios con Prisma simulado, motor suizo, cálculo de clasificación) y `coverage`, que mide qué sentencias y ramas recorren las pruebas; `static` (lint y tipos)              |
| Negra  | Solo los requisitos: entradas y salidas                       | `validators/blackBox.test.ts` (sección 8.1.1), `smoke`, `system`, `usability`, `compat`, `acceptance`                                                                                  |
| Gris   | Una parte del interior: la base, los límites, los middlewares | `integration` (consulta la base después de cada acción), `security` (conoce el umbral de intentos y el anti-CSRF), `load`, `stress`, `endurance`, `recovery`, `installation`, `sanity` |

## 9. Ejecución casos de prueba

**Ejecución del 5 de noviembre de 2026**, sobre el commit `c789f1f` de `main` más los archivos de este plan, que solo agregan pruebas y documentación.

**Resultados por nivel:**

| Nivel                 | Suite                                                      | Archivos | Pruebas      | Aprobadas | Fallidas | Resultado                         |
| --------------------- | ---------------------------------------------------------- | -------- | ------------ | --------- | -------- | --------------------------------- |
| Unitario              | Backend (`--project unit`)                                 | 62       | 635          | 635       | 0        | Aprobado                          |
| Unitario (caja negra) | `validators/blackBox.test.ts`, incluido arriba             | 1        | 85           | 85        | 0        | Aprobado                          |
| Unitario              | Frontend (`npm test`)                                      | 90       | 815          | 815       | 0        | Aprobado                          |
| Integración           | Backend (`--project integration`)                          | 14       | 109          | 109       | 0        | Aprobado                          |
| Sistema (e2e)         | Frontend (`npm run test:e2e`)                              | 7        | 13           | 13        | 0        | Aprobado                          |
| Sistema (P01–P33)     | `runbooks/regresion.md`                                    | —        | 31 casos     | 31        | 0        | Aprobado                          |
| Sistema (P32, manual) | PDF contra la sala, "Copa Primavera 2026", sobre `d4084c5` | —        | 1            | 1         | 0        | Aprobado                          |
| Aceptación (P35)      | `entrega/acta-uat-p35.md`                                  | —        | 12 criterios | —         | —        | Pendiente: requiere a los actores |

**Cobertura de código** (las suites unitaria y de integración juntas, en el backend):

| Proyecto | Sentencias | Ramas   | Funciones | Líneas  | Umbral mínimo (sentencias / ramas / funciones / líneas) |
| -------- | ---------- | ------- | --------- | ------- | ------------------------------------------------------- |
| Backend  | 96,60 %    | 90,20 % | 96,72 %   | 97,05 % | 96 / 90 / 95 / 96                                       |
| Frontend | 94,19 %    | 89,07 % | 91,80 %   | 95,19 % | 93 / 88 / 91 / 94                                       |

**Compuertas del CI** (`.github/workflows/ci.yml`): lint, tipos, formato, pruebas con cobertura, compilación, `npm audit` y e2e. Las dos últimas ejecuciones en GitHub Actions sobre `main` terminaron en verde.

**Requerimientos no funcionales en producción:**

| ID    | Verificación                                                                                 | Resultado                                                                                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NF-02 | Cabeceras y sesión en producción                                                             | Cookie `torre_session` con `HttpOnly`, `Secure`, `SameSite=Lax` y `Path=/api`; ningún token en el almacenamiento del navegador; WebSocket sin errores de CSP. Aprobado                                                          |
| NF-05 | Tiempo de respuesta (15 peticiones seguidas por ruta, desde Bogotá, con la API ya despierta) | `GET /api/health`: mediana 0,54 s, p90 0,61 s. `GET /api/tournaments/public/rooms`: mediana 0,47 s, p90 0,82 s. Sala pública de un torneo de 10 jugadores y 4 rondas: mediana 0,74 s, p90 0,89 s. Aprobado para el uso previsto |
| NF-06 | Sala pública en producción                                                                   | Responde sin sesión, sin correos en la respuesta y con `X-Robots-Tag: noindex, nofollow`. Aprobado                                                                                                                              |
| —     | Recuperación de contraseña en producción                                                     | `503 PASSWORD_RESET_UNAVAILABLE`: producción no tiene correo (#130). Observación, no defecto del código                                                                                                                         |

En el plan gratuito de Render la API se duerme sin tráfico: la primera petición tarda cerca de un minuto. No cuenta en la muestra de NF-05.

**Ejecución por tipo (sección 8.5), del 6 de noviembre de 2026**, con `npm test` desde la raíz, en el equipo de desarrollo (Windows 11, Node 26, PostgreSQL local), sobre `7c2c5ad` más este cambio. Las 14 suites, en 12 min 54 s:

| Suite          | Tipo                         | Pruebas o comprobaciones                           | Resultado           |
| -------------- | ---------------------------- | -------------------------------------------------- | ------------------- |
| `static`       | Análisis estático            | Lint, tipos, formato y build de los dos            | Aprobado            |
| `unit`         | Unitarias                    | 635 + 815                                          | Aprobado            |
| `integration`  | Integración                  | 109                                                | Aprobado            |
| `coverage`     | Cobertura (caja blanca)      | 744, sobre los umbrales                            | Aprobado            |
| `smoke`        | Humo                         | 6                                                  | Aprobado            |
| `system`       | Sistema / E2E (y alfa)       | 13                                                 | Aprobado            |
| `usability`    | Interfaz y usabilidad        | 19 (21 pantallas con axe, en claro y oscuro)       | Aprobado            |
| `security`     | Seguridad                    | 27, más `npm audit` de los dos                     | Aprobado            |
| `compat`       | Compatibilidad               | 40 (10 en cada uno de 4 navegadores)               | Aprobado            |
| `installation` | Instalación y desinstalación | 10 comprobaciones                                  | Aprobado            |
| `load`         | Carga                        | 4 comprobaciones                                   | Aprobado            |
| `stress`       | Estrés                       | 3 comprobaciones                                   | Aprobado            |
| `endurance`    | Resistencia                  | 3 comprobaciones                                   | Aprobado tras OB-01 |
| `recovery`     | Recuperación                 | 9 comprobaciones en el servidor, 4 en el navegador | Aprobado            |

**Cifras de rendimiento** (la API real en un proceso propio, contra la base del seed):

| Prueba             | Usuarios virtuales | Peticiones por segundo | p50    | p95        | p99      | Errores                        |
| ------------------ | ------------------ | ---------------------- | ------ | ---------- | -------- | ------------------------------ |
| Carga, 30 s        | 50                 | 1.065                  | 45 ms  | 79 ms      | 87 ms    | 0                              |
| Estrés             | 100                | 1.007                  | 95 ms  | 167 ms     | 200 ms   | 0                              |
| Estrés             | 400                | 1.065                  | 324 ms | 621 ms     | 630 ms   | 0                              |
| Estrés             | 800                | 1.069                  | 651 ms | 1.273 ms   | 1.286 ms | 66 (0,6 %): deja de dar abasto |
| Tras estrés        | 10                 | 1.169                  | 8 ms   | 14 ms      | 16 ms    | 0: se recupera sola            |
| Resistencia, 5 min | 30                 | 1.004 → 1.127          | 25 ms  | 50 → 44 ms | 48 ms    | 0; memoria 42 → 42 MB          |

El techo de unas 1.100 peticiones por segundo es el de un solo proceso de Node: con más usuarios no sube el caudal, sube la espera. Para un torneo universitario, de decenas de personas que refrescan una página, hay margen de sobra.

**Recuperación:** la API muerta de golpe vuelve en 0,56 s, sin perder lo guardado y con las sesiones vigentes; sin base de datos responde 500 sin que el proceso caiga, y se reconecta en 32 ms cuando la base vuelve.

**Observaciones** (no son defectos del sistema):

| ID    | Encontrado por | Observación                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OB-01 | Resistencia    | En la primera corrida el montículo creció de 50 a 122 MB en 5 minutos. La prueba mandaba cada petición desde una dirección nueva (330.000), y los límites de peticiones guardan en memoria un contador por dirección durante su ventana de 15 minutos. Con un campus de 4.000 direcciones, la memoria queda plana. Detrás de Vercel la dirección no se puede inventar, así que la memoria crece con los clientes reales y se libera al cerrar la ventana |
| OB-02 | Compatibilidad | WebKit en Windows no implementa `SameSite` y reporta todas las cookies como `None`. Ahí la prueba se apoya en la cabecera `Set-Cookie`, que en los cuatro navegadores pide `SameSite=Lax`                                                                                                                                                                                                                                                                |
| OB-03 | Usabilidad     | axe marcaba falta de contraste en la tarjeta animada de la portada: la medía a mitad de su animación de entrada. Se mide con movimiento reducido, es decir, en reposo                                                                                                                                                                                                                                                                                    |

**Defectos encontrados durante la ejecución:**

| ID    | Encontrado por                      | Defecto                                                                                                                                                                                      | Severidad | Causa                                                                                                    | Corrección          |
| ----- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------- | ------------------- |
| DF-01 | E2E-09 (ensayo técnico de la UAT)   | La fecha de fin aparecía vacía al recargar la configuración del torneo                                                                                                                       | Alta      | La API envía la fecha con hora, y el campo solo acepta el día                                            | 9a83ae9, con prueba |
| DF-02 | CB-18 (caja negra, valor límite)    | Una fecha de nacimiento del 1 de enero de 1900 se rechazaba en Colombia                                                                                                                      | Baja      | El año se leía en la zona horaria del servidor: en UTC-5 esa fecha cae en 1899                           | 977c9ee, con prueba |
| DF-03 | Revisión del mismo patrón que DF-02 | La edad de un jugador sumaba un año el día antes de su cumpleaños                                                                                                                            | Media     | La fecha de nacimiento y "hoy" se leían en la zona del servidor, no como días del calendario de Colombia | c789f1f, con prueba |
| DF-04 | Usabilidad (axe, WCAG 2.5.3)        | El botón de idioma se anunciaba "Switch to English" aunque muestra "ES", y el menú de usuario "Menú de …" aunque muestra las iniciales: quien maneja la voz dice lo que ve y no lo encuentra | Media     | El nombre accesible no contenía el texto visible                                                         | 2417d4f, con prueba |

Los cuatro quedaron corregidos, cada uno con una prueba que falló antes de la corrección y pasa después. Ningún defecto queda abierto.

**Conclusión de la ejecución:** se cumplen los criterios de salida 1, 2, 4, 5 y 6 de la sección 10. Falta el 3 (la UAT P35).

## 10. Criterios de aceptación

Los criterios de salida de la validación, del documento de sustentación:

| #   | Criterio                                                                                 | Estado                                               |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Todos los casos P01–P33 cumplen el resultado esperado                                    | Cumplido                                             |
| 2   | La regresión P34 se ejecuta sin introducir fallos críticos ni altos                      | Cumplido                                             |
| 3   | La UAT P35 la aprueban los actores del torneo                                            | Pendiente (#114)                                     |
| 4   | Cero fallos críticos abiertos en los flujos principales                                  | Cumplido                                             |
| 5   | Trazabilidad completa entre requisito, historia, caso de uso, caso de prueba y evidencia | Cumplido: secciones 7 y 8, y `runbooks/regresion.md` |
| 6   | El sistema está desplegado y verificado en el ambiente de destino                        | Cumplido: sección 9                                  |

Además, para cada commit:

- **Pruebas automáticas:** todas en verde.
- **Cobertura:** igual o mayor que los umbrales (decisión 008).
- **Dependencias:** `npm audit` sin vulnerabilidades altas.

## 11. Criterios de suspensión

Las pruebas se suspenden, y no se cita a los actores de la UAT, si ocurre cualquiera de estas situaciones:

1. El CI de `main` está en rojo por un fallo del código, no del entorno (la tabla de fallos de entorno está en `runbooks/validar-ci.md`).
2. Aparece un defecto crítico en el emparejamiento, el registro de resultados o la clasificación. Seguir produciría resultados oficiales que no se pueden confiar.
3. Aparece una exposición de datos personales: un correo, un código o un dato sensible visible para quien no debe verlo.
4. Producción no responde (`/api/health` no da `ok`), o la base de datos no está disponible.
5. Durante la UAT, un actor no puede completar el flujo principal por un defecto. No es lo mismo que una duda de uso, que se anota como hallazgo y la sesión sigue.
6. El ensayo técnico automático (E2E-09) está en rojo.

## 12. Criterios de reanudación

Las pruebas se reanudan cuando:

1. El defecto que causó la suspensión está corregido en `main`, con una prueba que falló antes de la corrección y pasa después.
2. El CI completo está en verde en ese commit, incluidos los e2e.
3. Se repiten los casos afectados por la corrección y la regresión completa (P34). En el caso de la UAT, se repite la sesión desde el paso donde se suspendió.
4. Si la causa fue una exposición de datos: se revisó con `/revision-seguridad` y la prueba de privacidad correspondiente corre contra la base real.
5. Si la causa fue el ambiente: `/api/health` responde `ok` y los pasos de "Verificar" de `runbooks/despliegue.md` pasan.

## 13. Recursos

### 13.1 Recursos de hardware y software

| Recurso                  | Detalle                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Equipo de desarrollo     | Procesador AMD Ryzen 9 5950X de 16 núcleos, 32 GB de RAM, Windows 11 Pro                                |
| Integración continua     | GitHub Actions, `ubuntu-latest`, con PostgreSQL 16 como servicio                                        |
| Producción               | Vercel (aplicación) y Render, plan gratuito (API y PostgreSQL)                                          |
| Entorno de ejecución     | Node.js 22 en el CI y producción (`.nvmrc`); Node 26 en el equipo local                                 |
| Base de datos            | PostgreSQL 18 en local, 16 en el CI                                                                     |
| Navegador de los e2e     | Chromium (Playwright)                                                                                   |
| Dispositivos para la UAT | El celular del árbitro y de los jugadores, y un computador para el organizador, con conexión a internet |

### 13.2 Herramientas de pruebas

| Herramienta                       | Versión         | Uso                                                                             |
| --------------------------------- | --------------- | ------------------------------------------------------------------------------- |
| Vitest                            | 5.0.5           | Pruebas unitarias y de integración, con cobertura (`@vitest/coverage-v8` 5.0.5) |
| Supertest                         | 7.2             | Peticiones HTTP a la API en las pruebas de rutas e integración                  |
| Vue Test Utils                    | 2.5             | Montaje de componentes y vistas                                                 |
| Playwright                        | 1.63.0          | Pruebas de sistema en navegador: Chromium, Firefox, WebKit y teléfonos emulados |
| axe-core (`@axe-core/playwright`) | 4.14            | Revisión automática de accesibilidad WCAG 2.1 AA                                |
| `fetch` de Node, `node:net`       | Node 22         | Generador de carga y proxy TCP para cortar la base (sin dependencias nuevas)    |
| Prisma                            | 7.10.0          | Migraciones de la base de prueba                                                |
| ESLint, Prettier, TypeScript      | 10.11, 3.9, 6.0 | Análisis estático, formato y tipos                                              |
| `npm audit`                       | —               | Vulnerabilidades de dependencias                                                |
| GitHub Actions                    | —               | Ejecución de todas las compuertas en cada commit                                |
| curl                              | —               | Verificación del ambiente de producción y muestra de tiempos de respuesta       |

Las versiones exactas de las demás dependencias están en `package-lock.json` de cada proyecto.

### 13.3 Recursos de personal

| Rol en las pruebas                 | Quién                                                             | Responsabilidad                                                                  |
| ---------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Diseño, automatización y ejecución | Nilson Aldair Molina Rengifo (autor)                              | Este plan, las pruebas automáticas, la regresión y la verificación en producción |
| Organizador (UAT)                  | Un organizador de torneos de la universidad que no sea del equipo | Ejecutar CA-01 a CA-04, CA-09 y CA-10, y firmar el acta                          |
| Árbitro (UAT)                      | El árbitro del torneo                                             | Ejecutar CA-06 y CA-07                                                           |
| Jugadores (UAT)                    | Dos o tres estudiantes                                            | Ejecutar CA-03, CA-05, CA-11 y CA-12                                             |
| Observador (UAT)                   | El autor                                                          | Anotar hallazgos sin ayudar a los actores                                        |
| Docente                            | El docente de la asignatura                                       | Acordar cómo se evalúa CA-12 mientras producción no tenga correo                 |

Los nombres de los actores de la UAT se registran en el acta cuando se haga la sesión.

### 13.4 Recursos de entrenamiento

- **Manual de usuario** ([`manual-de-usuario.md`](manual-de-usuario.md)): las tareas de cada rol, con los textos exactos de la pantalla.
- **Cuentas de demostración** del seed (contraseña `Test1234`), una por rol, para practicar antes de la sesión.
- **Torneos del seed**, con historial real (cinco finalizados y uno en curso), para ver una sala y una clasificación antes de crear un torneo.
- **El ensayo** ([`runbooks/ensayo-uat.md`](runbooks/ensayo-uat.md)), que hace de entrenamiento: los actores recorren un día de torneo antes de la sesión de aceptación.
- **Para el equipo:** [`runbooks/validar-ci.md`](runbooks/validar-ci.md) (correr las pruebas como el CI) y [`architecture.md`](architecture.md#estrategia-de-pruebas) (estrategia de pruebas).

La UAT no da instrucciones durante la sesión: el criterio CA-05 mide que un jugador encuentre su mesa sin ayuda.

## 14. Manual de usuario

El manual está en [`manual-de-usuario.md`](manual-de-usuario.md). Cubre:

1. Lo común a todos: crear una cuenta, entrar, recuperar la contraseña, editar el perfil, los avisos y los derechos sobre los datos.
2. El visitante sin cuenta: torneos abiertos y sala pública.
3. Cada rol: jugador, entrenador, organizador, árbitro y administrador.
4. Una tabla de problemas frecuentes.

**Validación.** `frontend/src/manual.test.ts` lee el manual y comprueba dos cosas:

- que cada texto citado entre comillas angulares existe en la interfaz en español;
- que cada ruta citada existe en el enrutador de la aplicación.

En la ejecución de la sección 9 pasó con todos los textos y rutas del manual. Como corre en cada commit, un botón renombrado o una página movida rompen el CI hasta que el manual se actualiza. Los flujos que describe también se recorren de punta a punta en los e2e (E2E-04 a E2E-09).

## 15. Análisis y conclusiones

**Análisis**

- **Trazabilidad completa.** Cada requerimiento (RF01–RF23) y cada regla (RN-01 a RN-11) llevan a uno o más casos de prueba (sección 7), y cada caso a una prueba automática que se puede correr con un comando. Las desviaciones del documento de sustentación no se esconden en el resultado esperado: están en `runbooks/regresion.md` con su porqué. Son ARO, la visibilidad de las estadísticas, el consentimiento para el entrenador, los retiros en los desempates, el motor simplificado y la política de datos.
- **Las pruebas encontraron defectos reales.** El ensayo técnico de la UAT encontró la fecha de fin vacía (DF-01), y los valores límite de caja negra, la fecha de 1900 en la zona horaria de Colombia (DF-02). Revisar el mismo patrón llevó a la edad mal calculada (DF-03). DF-02 solo aparecía en la máquina local y no en el CI, que corre en UTC. Desde esta ejecución, las pruebas unitarias corren en la hora de Colombia en cualquier máquina. La revisión de accesibilidad con axe encontró que dos botones no se llamaban como lo que muestran (DF-04).
- **Lo que solo la base puede probar, se prueba contra la base.** Las carreras entre peticiones, las restricciones `CHECK` y la privacidad se prueban contra PostgreSQL real, no con simulaciones. Esas pruebas sostienen la regla de que todo cambio a un torneo pasa bajo bloqueo ([decisión 004](decisions/004-cambios-a-un-torneo-bajo-bloqueo.md)).
- **Cobertura alta y que no baja.** 96,6 % de sentencias en el backend y 94,2 % en el frontend, con umbrales que el CI exige y que solo se pueden subir.
- **Todos los tipos, con un comando.** Funcionales y no funcionales, de caja blanca, negra y gris, corren con `npm test` desde la raíz y dejan su resumen en `reports/resumen-pruebas.md` (sección 8.5). El CI corre en cada commit las que no dependen de la velocidad de la máquina: humo, usabilidad, seguridad, recuperación, instalación y carga.
- **Límites conocidos.** Carga, estrés y resistencia se miden en local, no en el plan gratuito de Render, que solo mediría ese plan. En Firefox, WebKit y los teléfonos corren el humo y los flujos de solo lectura; los que cambian datos, en Chromium. La revisión automática de accesibilidad encuentra cerca de la mitad de los problemas: el resto es de la UAT. El envío real de correo no se puede probar en producción mientras no haya proveedor.

**Conclusiones**

1. El sistema cumple los criterios de salida que dependen del equipo: los casos funcionales, la regresión sin fallos, cero defectos críticos abiertos, trazabilidad completa y verificación en producción.
2. La aceptación P35 es el único criterio pendiente. Necesita al organizador, al árbitro y a los estudiantes. El acta, el guion del ensayo, el manual y las cuentas de demostración están listos.
3. Las pruebas automáticas son la red de seguridad del código congelado: cualquier corrección que bloquee la aceptación tiene que pasar las mismas suites (`npm test`) antes de llegar a producción.
4. Recomendación para la sesión de aceptación: hacer antes el ensayo (#131), configurar el correo en Render (#130) para poder evaluar CA-12, y anunciar en las bases del torneo el motor suizo simplificado.
