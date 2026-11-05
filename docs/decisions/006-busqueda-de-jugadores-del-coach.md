# 006. La búsqueda de jugadores del coach

Vigente desde el 21 de octubre de 2026. Reemplaza la búsqueda exacta del 4 de octubre de 2026.

## Contexto

`COACH` es un rol que cualquiera puede elegir al registrarse. La búsqueda de jugadores devolvía, de diez en diez, nombre, código universitario, programa y semestre de quien coincidiera con cualquier fragmento: con consultas cortas ("a", "2026") un coach recién registrado podía recorrer todo el directorio.

La auditoría de seguridad del 4 de octubre lo cerró exigiéndole al coach el valor completo: nombre exacto, correo o código. En la práctica la búsqueda quedó inútil: había que escribir el nombre letra por letra, con tildes y segundos nombres, así que casi siempre salía vacía.

## Decisión

Para un coach:

- **Nombre**: coincide si cada palabra que escribió es una palabra completa del nombre, sin importar mayúsculas ni tildes, y escribió al menos dos. "laura perez" encuentra a "Laura Isabel Pérez Gómez"; "lau" o "Laura" sola no encuentran a nadie.
- **Correo y código**: completos, sin importar mayúsculas.

Organizadores y administradores, que gestionan torneos y clubes, siguen buscando por cualquier fragmento.

**Qué ve el coach** (desde el 5 de noviembre de 2026, #124): de un jugador que todavía no aceptó su vínculo, solo el nombre (y el `id` para pedirle el vínculo). Código universitario, programa y semestre llegan cuando el jugador acepta, en la búsqueda y en la lista "Mis jugadores". Organizadores y administradores los siguen viendo siempre. Es el punto medio de "seguridad sobre comodidad": se recortan campos, no la búsqueda.

## Consecuencias

- Un coach encuentra al jugador que le dio su nombre y apellido, sin poder recorrer el directorio con fragmentos.
- Si dos jugadores comparten nombre, el coach no los distingue por código ni programa antes de pedir el vínculo: el jugador equivocado rechaza la solicitud. Es el precio de no darle a una cuenta que cualquiera puede crear datos que el titular no autorizó (HU24, Ley 1581: circulación restringida).
- Las tildes se ignoran con la extensión `unaccent` de PostgreSQL (migración `20261022000000_unaccent`): la base de producción tiene que permitirla (en PostgreSQL 13 o superior la puede crear el dueño de la base).
- La comparación por palabras se hace en SQL crudo; el resto de la búsqueda sigue en Prisma.
- Si la búsqueda vuelve a parecer "rota" para un coach, no basta con volver a los fragmentos: eso reabre la exposición del directorio. Cualquier cambio tiene que mantener el límite.

## Dónde está

- `backend/src/services/players.service.ts` (`playersNamed`, `matching`, `searchPlayers`) y `coaches.service.ts` (`listLinkedPlayers`).
- `backend/src/routes/privacy.int.test.ts` ("player search") y `backend/src/services/players.service.test.ts`.
