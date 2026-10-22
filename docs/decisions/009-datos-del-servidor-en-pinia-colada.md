# 009. Los datos del servidor viven en Pinia Colada

Vigente desde septiembre de 2026.

## Contexto

Los datos del servidor vivían en stores de Pinia escritos a mano. Cada uno reimplementaba carga, error y reintento; una respuesta tardía de un torneo podía aparecer en la página de otro, y las páginas repetían peticiones que ya estaban en vuelo.

## Decisión

- Lo que viene del servidor vive en la caché de Pinia Colada. Cada lectura se define en `queries/` (clave y petición), y cada página la usa con `useQuery` y muestra carga, error y reintento con `useQueryStatus`.
- Todo lo de un torneo cuelga de la clave `["tournament", id]`; el panel lleva además el usuario en la clave, para que en un equipo compartido nadie vea el del anterior.
- Después de escribir, la página guarda en la caché lo que respondió el servidor o invalida lo que el cambio afecta. Un evento en tiempo real invalida la clave del torneo.
- Las páginas pesadas inician sus lecturas en el `beforeEnter` de la ruta, mientras se descarga su código.
- Los stores quedan para el estado del cliente: sesión, tema, idioma, diálogo de confirmación.

## Consecuencias

- Una respuesta tardía nunca pisa otra página, y las peticiones repetidas se comparten.
- Un formulario abierto no se pisa cuando la caché se vuelve a leer en segundo plano: solo sigue al servidor mientras no tenga cambios sin guardar.
- En los tests, la caché vive en el Pinia activo: montar la misma vista dos veces en un test devuelve los datos del primer montaje.

## Dónde está

- `frontend/src/queries/` (`tournaments.ts`, `prefetch.ts`, `status.ts`).
- `frontend/src/router/index.ts` (los `beforeEnter` que precargan).
