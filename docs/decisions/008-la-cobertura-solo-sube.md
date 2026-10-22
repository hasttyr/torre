# 008. La cobertura solo sube

Vigente desde septiembre de 2026.

## Contexto

Un umbral de cobertura bajo y fijo no avisa cuando un cambio deja código nuevo sin probar. Uno que se baja cada vez que molesta no sirve de nada.

## Decisión

- Los umbrales de cada proyecto (`backend/vitest.config.mts`, `frontend/vitest.config.ts`) son los niveles actuales, en statements, branches, functions y lines. Cuando la cobertura sube, se suben.
- No se bajan para que pase el CI. Si un cambio deja la cobertura por debajo, se agregan tests al código real que quedó sin cubrir.
- Si una herramienta cambia cómo cuenta (en octubre de 2026, actualizar `vite` a 8.3.5 hizo que el frontend contara 994 funciones en vez de 1005, sin tocar código, y dejó funciones en 90,94 % contra 91 %), tampoco se baja: se cubre código que de verdad no tenía test.

## Consecuencias

- Una actualización de dependencias puede necesitar tests nuevos para pasar el CI.
- La cobertura en local puede diferir del CI por el entorno (ver [`runbooks/validar-ci.md`](../runbooks/validar-ci.md)); manda el CI.

## Dónde está

- `thresholds` en `backend/vitest.config.mts` y `frontend/vitest.config.ts`.
- `.github/workflows/ci.yml` (`npm run test:coverage` en los dos proyectos).
