---
name: arreglar-bug
description: "Usar cuando algo de torre no funciona como se espera: un mensaje de error en pantalla, un 4xx o 5xx inesperado, una búsqueda que no encuentra, datos o estados que no cuadran, algo que dice lo que no es, o un test que falla."
---

# Arreglar un bug en torre

Primero la causa, después el arreglo, y siempre con un test que falle antes del arreglo. **REQUIRED SUB-SKILL:** superpowers:systematic-debugging para el método general; aquí va lo propio de este repo.

## Encontrar de dónde sale

- **Un texto en pantalla**: buscarlo en `frontend/src/i18n/locales/es.json`, tomar su clave y buscar la clave en `frontend/src`.
- **Un mensaje de error de la API**: buscarlo en `backend/src/contracts/errors.ts`, tomar su código y buscar `HttpError("CODIGO"` en `backend/src`.
- **Un cambio reciente**: `git log --oneline -- <archivo>` y `git log -S "<texto>"`. Un arreglo de seguridad reciente puede ser la causa: la búsqueda del coach quedó "siempre vacía" por uno.

## ¿Bug o decisión?

Si la causa es una regla a propósito (está en `docs/decisions/` o el commit explica el porqué), no es un bug que se revierte: explicar la regla y proponer opciones al usuario, como un punto medio que conserve su objetivo. No deshacer un arreglo de seguridad sin preguntar.

## El test que falla primero

| Dónde está la causa                    | Test                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Regla en un servicio                   | `services/<x>.service.test.ts`, con el mock de Prisma del archivo (agregar los métodos nuevos que use el arreglo) |
| SQL, restricción, transacción, carrera | `*.int.test.ts` contra PostgreSQL (corre en local)                                                                |
| Respuesta HTTP o compuerta de rol      | `routes/*.test.ts`                                                                                                |
| Pantalla: texto, estado, interacción   | `X.test.ts` junto a la vista; un escenario por test (la caché de Pinia Colada persiste en el mismo Pinia)         |
| URL o cuerpo de una llamada            | `frontend/src/services/http.test.ts`                                                                              |

Correrlo **antes** del arreglo y confirmar que falla por la razón del bug, no por el test. Si pasa antes del arreglo, no reproduce el bug.

## Arreglar y cerrar

1. En la capa dueña de la regla: si el backend decide, el arreglo va en el backend aunque el síntoma esté en pantalla.
2. Si el mismo síntoma aparece en otros lugares (otro enlace con el mismo texto equivocado), arreglarlos en el mismo commit, cada uno con su test.
3. Un commit por bug: asunto que diga el comportamiento corregido ("A finished tournament's room isn't live"), cuerpo con la causa.
4. Skill `validar-ci`.

## Errores comunes

| Error                                        | En su lugar                                                   |
| -------------------------------------------- | ------------------------------------------------------------- |
| Ajustar el test hasta que pase               | El test describe el comportamiento esperado; cambia el código |
| Esconder el síntoma en el frontend           | Arreglar donde vive la regla                                  |
| Varios bugs en un commit                     | Uno por commit, cada uno con su test                          |
| "Ya funciona" sin haber visto fallar el test | Ver el test en rojo antes, en verde después                   |
