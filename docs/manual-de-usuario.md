# Manual de usuario

Cómo se usa Torre Central Hub, por rol. Los textos entre comillas angulares son los que aparecen en pantalla, tal cual. Un test (`frontend/src/manual.test.ts`) comprueba que cada uno existe en la aplicación y que cada ruta citada existe, así que si la interfaz cambia, este manual se actualiza con ella.

- **Aplicación:** `https://torre-roan.vercel.app`. Funciona en el computador y en el celular. En el celular, las tablas se muestran como tarjetas, una por fila, y sus columnas se ordenan con «Ordenar por».
- **Cuentas de demostración** (contraseña `Test1234`): `admin@test.com`, `organizer@test.com`, `arbiter@test.com`, `coach@test.com` y `player@test.com`.
- La primera visita del día puede tardar cerca de un minuto: el servidor gratuito se duerme sin tráfico.

## Contenido

1. [Para todos](#1-para-todos)
2. [Visitante sin cuenta](#2-visitante-sin-cuenta)
3. [Jugador](#3-jugador)
4. [Entrenador](#4-entrenador)
5. [Organizador](#5-organizador)
6. [Árbitro](#6-árbitro)
7. [Administrador](#7-administrador)
8. [Problemas frecuentes](#8-problemas-frecuentes)

## 1. Para todos

### Crear una cuenta

1. En la portada, «Crear cuenta» (`/registro`).
2. Elige el rol: jugador o entrenador. Organizador, árbitro y administrador no se eligen aquí: los asigna un administrador.
3. Completa «Nombre», correo y contraseña (mínimo 8 caracteres). Si eres jugador, también «Código universitario», «Programa» y «Semestre».
4. Lee la política con «Leer la política» (abre `/politica-de-datos` en otra pestaña) y marca «Acepto la política de tratamiento de datos personales, conforme a la Ley 1581 de 2012.». Sin esa casilla la cuenta no se crea.
5. «Crear cuenta». Después entras con «Iniciar sesión».

### Entrar y salir

- «Iniciar sesión» (`/login`): correo y contraseña, y «Ingresar». Cada rol llega a su «Panel» (`/panel`).
- Para salir: el menú con tu nombre, arriba a la derecha, y «Cerrar sesión». En ese menú también están «Tema» (claro u oscuro) e «Idioma» (español o inglés).

### Recuperar la contraseña

1. En la pantalla de entrada, «¿Olvidaste tu contraseña?» (`/olvide-password`).
2. Escribe tu correo y «Enviar instrucciones». La respuesta es la misma exista o no la cuenta, para no revelar quién está registrado.
3. Abre el enlace del correo (vale una vez, durante una hora), escribe la «Nueva contraseña» dos veces y «Restablecer contraseña».

Si el sistema no tiene correo configurado, la pantalla lo dice y la recuperación no está disponible: pide ayuda a un administrador.

### Mi cuenta

En el menú con tu nombre, «Mi perfil» (`/cuenta`):

- **«Editar perfil»:** tu nombre y, si eres jugador, código, programa, semestre, fecha de nacimiento, género y discapacidad. Los tres últimos son opcionales: puedes dejarlos vacíos o borrarlos. «Guardar cambios». Solo puedes editar tus propios datos.
- **«Mi club y entrenadores»** (jugador): el club al que perteneces y los entrenadores que te siguen. Si un entrenador pidió seguirte, «Aceptar» o «Rechazar». Un entrenador ve tu progreso solo después de que lo aceptes, y lo quitas cuando quieras.
- **«Avisos»** (jugador): «Avisarme por correo cuando se publique una ronda de un torneo que juego». El correo dice qué ronda se publicó y enlaza a la sala.
- **«Privacidad y datos personales»:** la fecha y la versión de la política que aceptaste, «Descargar mis datos» (un archivo con todo lo que el sistema guarda de ti) y «Eliminar mis datos». Si juegas un torneo en curso, la eliminación se completa cuando el torneo termina.

## 2. Visitante sin cuenta

- **«Torneos abiertos»** (`/torneos-abiertos`): los torneos con inscripción abierta, con sus rondas, ritmo y quién puede inscribirse. Para inscribirte necesitas una cuenta de jugador.
- **Sala pública:** en la misma página, «Torneos en juego y terminados», y en cada torneo «Ver la sala →» (`/sala-publica/:id`). Muestra la última ronda, la clasificación y las rondas anteriores, solo con nombres y resultados. Mientras el torneo está en juego se actualiza sola cada minuto, así que sirve para proyectarla en el lugar del torneo.

## 3. Jugador

### Inscribirse

1. «Torneos» en el menú (`/mis-torneos`).
2. En «Torneos disponibles», «Inscribirme». Si el torneo pide un programa o un semestre mínimo y no los cumples, la pantalla lo dice.
3. Mientras las inscripciones sigan abiertas puedes «Cancelar inscripción». Tus torneos quedan en «Mis inscripciones».

### Durante el torneo

- Desde «Mis inscripciones», o desde «En juego» (`/en-juego`), entra a la sala del torneo (`/torneos/:id/sala`).
- Arriba aparece «Tu partida · Ronda N»: tu mesa, tu color y tu rival. Si te toca el bye, dice «Descansas: tienes el bye de esta ronda.».
- «Emparejamientos» muestra todas las mesas de cada ronda, y «Clasificación», los puntos y los desempates. Se actualizan solos cuando el árbitro registra un resultado.
- Al terminar el torneo, la sala muestra el podio y tu puesto.

### Tu panel

En «Panel» ves tu historial, tus torneos y tus estadísticas, según los controles que el administrador asignó a los jugadores.

## 4. Entrenador

1. «Mis jugadores» (`/mis-jugadores`).
2. Busca al jugador por nombre y apellido, o por su correo o código completos, y «Solicitar». Queda «Esperando que acepte» hasta que el jugador te acepte desde su cuenta. Mientras tanto puedes «Cancelar solicitud».
3. Cuando acepta, ves su progreso en tu «Panel» y sus torneos en «Torneos de mis jugadores».
4. «Desvincular» deja de seguirlo.

## 5. Organizador

### Crear y configurar un torneo

1. «Mis torneos» (`/torneos`), «+ Crear torneo» (`/torneos/nuevo`).
2. «Nombre del torneo», «Fecha de inicio» y «Fecha de fin». «Crear torneo». El torneo queda en estado preliminar, y solo tú lo ves.
3. En la página del torneo (`/torneos/:id`), «Configuración del torneo»:
   - «Número de rondas», «Ritmo» y «Fecha de fin». Al pasar la fecha de fin, un torneo en curso se cierra solo; si se alarga, extiende la fecha antes.
   - «Valor del bye»: 1, ½ o 0 puntos.
   - «Orden de desempates»: elige con «Agregar» y ordena con las flechas. Si no eliges ninguno, se usa el orden sugerido.
   - «Elegibilidad de inscripción (opcional)»: «Programa restringido» y «Semestre mínimo».
   - «Guardar configuración». Desde la ronda 1 el orden de desempates y el valor del bye ya no cambian.

Las bases del torneo deben anunciar que el emparejamiento es un suizo simplificado: sin rating y sin los criterios absolutos de color de FIDE.

### Inscripciones

- «Abrir inscripciones» permite inscribir jugadores; los jugadores también pueden inscribirse solos.
- En «Jugadores inscritos», «Buscar jugador (nombre, correo o código)» e «Inscribir».
- «Cerrar inscripciones» antes de emparejar. Si llega alguien tarde y aún no se publicó la ronda 1, «Reabrir inscripciones».
- «Retirar» saca a un jugador: no se empareja más, y sus resultados anteriores se conservan.

### Rondas

1. Con las inscripciones cerradas y el número de rondas configurado, en «Rondas», «Generar ronda 1».
2. La ronda queda en borrador: solo tú la ves. Revísala.
   - **«Ajuste manual»:** elige «Jugador» e «Intercambiar con», escribe el «Motivo del ajuste» (queda en la bitácora) y «Aplicar ajuste».
   - **«Descartar borrador»** borra los emparejamientos para generarlos de nuevo.
3. «Publicar ronda 1» y confirma con «Publicar». Todos la ven en la sala, y los jugadores con el aviso activo reciben un correo.
4. Cuando todas las mesas tienen resultado, «Generar ronda 2», y así hasta la última.

Si ningún emparejamiento evita repetir un enfrentamiento, la pantalla lo dice. Puedes autorizar la revancha escribiendo el «Motivo de la revancha» y «Generar con revancha»: se repiten las menos partidas posibles, y queda en la bitácora.

### Resultados, documentos y cierre

- Los resultados se registran en la sala, como el árbitro (sección 6).
- En la sala, «Clasificación (PDF)» y «Ronda 1 (PDF)» descargan los documentos oficiales para publicarlos en el lugar del torneo.
- Con todas las rondas jugadas y registradas, «Finalizar torneo». Desde entonces el torneo no admite cambios.

### Clubes

«Clubes» (`/clubes`): escribe el «Nombre del club» y «Crear club». Selecciona un club para ver sus jugadores, busca a uno y «Agregar», o «Quitar». «Renombrar» cambia el nombre, y «Eliminar club» solo funciona si el club no tiene jugadores.

## 6. Árbitro

1. «En juego» (`/en-juego`), y en el torneo «Seguir en vivo →».
2. En «Emparejamientos», en cada mesa, el botón del resultado: `1 – 0` («Ganan blancas»), `½ – ½` («Tablas») o `0 – 1` («Ganan negras»). Si alguien no llegó, en el grupo de incomparecencias: `1F – 0F` («No se presentaron las negras»), `0F – 1F` («No se presentaron las blancas») o `0F – 0F` («No se presentó ninguno»). Una incomparecencia suma el punto, pero no cuenta como partida jugada.
3. La clasificación se recalcula sola, y todos los que tienen la sala abierta la ven al instante.
4. Para cambiar un resultado ya registrado: «Corregir», el resultado correcto, el «Motivo de la corrección (opcional)» y «Guardar corrección». La corrección queda en la bitácora.
5. Los PDF están en la misma sala: «Clasificación (PDF)» y los de cada ronda.

## 7. Administrador

- **«Usuarios»** (`/usuarios`): busca una cuenta, «Cambiar rol» (así se crean organizadores, árbitros y otros administradores) y «Activar» o «Desactivar». Un cambio de rol cierra las sesiones abiertas de esa cuenta.
- **«Auditoría»** (`/auditoria`): las acciones críticas (cambios de rol, correcciones, ajustes, retiros…) con quién, cuándo y por qué. «Cargar anteriores» trae las más viejas.
- **«Configurar paneles»** (`/panel/configuracion`): elige el «Rol a configurar», agrega controles desde el «Catálogo de controles», ordénalos con las flechas y «Guardar panel».
- Un administrador también puede hacer todo lo del organizador, en cualquier torneo.

## 8. Problemas frecuentes

| Qué pasa                                            | Por qué y qué hacer                                                                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| La página tarda en cargar la primera vez            | El servidor se estaba despertando. Espera un minuto y recarga                                                                                       |
| «Sin conexión en vivo» en la sala                   | Se perdió la conexión en tiempo real. La sala se reconecta sola; si no, recarga                                                                     |
| No aparece el botón para generar la ronda           | Las inscripciones siguen abiertas o falta el número de rondas: «Cierra las inscripciones y configura el número de rondas para empezar a emparejar.» |
| No se puede inscribir a un jugador                  | Las inscripciones están cerradas, ya está inscrito, o no cumple el programa o el semestre mínimo                                                    |
| No se puede finalizar el torneo                     | Falta una ronda o un resultado                                                                                                                      |
| El entrenador no ve a un jugador                    | El jugador todavía no aceptó la solicitud en «Mi cuenta»                                                                                            |
| No llegan los avisos de ronda                       | El sistema no tiene correo configurado; «Mi cuenta» lo dice en «Avisos». Mira la sala del torneo                                                    |
| Un jugador no aparece en la búsqueda del entrenador | El entrenador busca con nombre y apellido, o con el correo o el código completos: no con fragmentos, por privacidad                                 |
