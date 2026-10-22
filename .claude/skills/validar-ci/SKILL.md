---
name: validar-ci
description: "Usar cuando hay que comprobar que un cambio en torre pasa el CI antes de decir que está listo, hacer commit, abrir un PR o fusionar; o cuando un job de GitHub Actions falló (backend, frontend, e2e, npm audit, cobertura) y hay que saber por qué."
---

# Validar como el CI

"Listo" en este repo significa: los tres jobs de `.github/workflows/ci.yml` en verde. Esta skill corre lo mismo en local y separa los fallos del código de los del entorno. Comandos completos y fallos conocidos: `docs/runbooks/validar-ci.md`.

## Pasos

1. **Qué tocó el cambio**: `git diff --stat main...HEAD` (y `git status`). Un cambio en `backend/src/contracts/` afecta a los dos proyectos.
2. **Correr las compuertas** de cada proyecto afectado, en el orden del CI (tabla del runbook). En el backend, `npm run test:coverage` incluye la suite de integración contra el PostgreSQL local: correrla, no suponer que no se puede.
3. **Cada fallo, clasificado** contra la tabla "Fallos que no son del código" del runbook. Lo que no está en la tabla es del código: se arregla, no se explica.
4. **Si el cambio toca un flujo entre roles** (sesión, sala en vivo, inscripción, resultados), también `npm run test:e2e` en `frontend/`.
5. **Informar** con este formato, una línea por compuerta:

   ```
   backend  lint ✓ · tipos ✓ · formato ✓ · tests+cobertura ✓ (N tests) · build ✓ · audit ✓
   frontend lint ✓ · formato ✓ · build ✓ · tests+cobertura ✗ (funciones 90,9 % < 91 %) · audit — (503 de npm, verificado con --loglevel=http)
   no verificado: e2e (no se corrió)
   ```

## En GitHub

`gh pr checks <pr>` → para el job rojo, `gh run view <run-id> --log-failed` (o el log del job por `gh api`, ver runbook) → clasificar igual que en local. Un fallo del servicio de npm se relanza con `gh run rerun <run-id> --failed`; cualquier otro, se reproduce en local antes de tocar código.

## Errores comunes

| Error                                                                                                | En su lugar                                                                                               |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Dar por bueno un cambio porque pasaron los tests del archivo tocado                                  | Correr las compuertas completas de cada proyecto afectado                                                 |
| Bajar un umbral de cobertura para que pase                                                           | Cubrir código real sin test (`docs/decisions/008-la-cobertura-solo-sube.md`)                              |
| Tratar un 503 de `npm audit` como vulnerabilidad, o una vulnerabilidad como "el servicio está caído" | Leer el error: un reporte con paquetes y severidades es real; un 503, timeout o `Invalid package tree` no |
| Concluir por la cobertura local de ramas del frontend                                                | Ver si la única diferencia es `services/socket.ts` (el `.env` local); manda el CI                         |
| Decir "pasa" cuando algo no se corrió                                                                | Ponerlo en "no verificado"                                                                                |
