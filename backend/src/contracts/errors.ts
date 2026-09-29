// Every error the API answers on purpose (B-D2): a stable code clients can
// branch on and word in their own language (the frontend's apiErrors.* in its
// locales, checked against this list), its HTTP status, and a Spanish
// message for any client that doesn't know the code. `{name}` placeholders
// are filled from the error's params, which are sent too.
export const API_ERRORS = {
  // Requests and sessions
  VALIDATION_FAILED: [400, "Los datos enviados no son válidos"],
  INVALID_JSON: [400, "El cuerpo de la petición no es un JSON válido"],
  PAYLOAD_TOO_LARGE: [413, "El cuerpo de la petición es demasiado grande"],
  BAD_REQUEST: [400, "La petición no es válida"],
  RATE_LIMITED: [429, "Demasiados intentos. Vuelve a intentarlo en unos minutos"],
  INTERNAL_ERROR: [500, "Error interno del servidor"],
  NOT_FOUND: [404, "Recurso no encontrado"],
  UNAUTHENTICATED: [401, "No autenticado"],
  INVALID_TOKEN: [401, "Token inválido o expirado"],
  SESSION_REVOKED: [401, "Tu sesión ya no es válida: vuelve a iniciar sesión"],
  FORBIDDEN: [403, "No tienes permiso para esta acción"],
  CROSS_SITE_REQUEST: [403, "La petición no viene de la aplicación"],

  // Accounts
  INVALID_CREDENTIALS: [401, "Credenciales inválidas"],
  ACCOUNT_INACTIVE: [403, "La cuenta está inactiva"],
  EMAIL_TAKEN: [409, "Ya existe una cuenta registrada con ese correo"],
  RESET_LINK_INVALID: [400, "El enlace de restablecimiento no es válido o ya expiró"],
  PASSWORD_RESET_UNAVAILABLE: [503, "La recuperación de contraseña no está disponible. Pide ayuda a un administrador"],
  ROLE_NOT_FOUND: [404, 'El rol "{role}" no existe'],
  USER_NOT_FOUND: [404, "Usuario no encontrado"],
  NOT_A_PLAYER: [400, "Este usuario no tiene un perfil de jugador para actualizar"],
  OWN_ACCOUNT_STATUS: [409, "No puedes cambiar el estado de tu propia cuenta"],
  LAST_ADMINISTRATOR: [409, "Debe quedar al menos un administrador activo"],
  ACCOUNT_SUPPRESSED: [409, "Los datos de esta cuenta fueron suprimidos: no se puede reactivar"],

  // Clubs, players and coaches
  CLUB_NOT_FOUND: [404, "Club no encontrado"],
  CLUB_NAME_TAKEN: [409, "Ya existe un club con ese nombre"],
  CLUB_NOT_EMPTY: [409, "No se puede eliminar un club con jugadores asignados; quítalos primero"],
  PLAYER_NOT_IN_CLUB: [404, "El jugador no pertenece a este club"],
  PLAYER_NOT_FOUND: [404, "Jugador no encontrado"],
  ALREADY_LINKED: [409, "Ya estás vinculado con este jugador"],
  NOT_LINKED: [404, "No estás vinculado con este jugador"],
  COACH_NOT_LINKED: [404, "Ese entrenador no sigue tu progreso"],

  // Tournaments
  TOURNAMENT_NOT_FOUND: [404, "Torneo no encontrado"],
  TOURNAMENT_FORBIDDEN: [403, "No tienes permiso para administrar este torneo"],
  TOURNAMENT_FINISHED: [409, "El torneo ya finalizó: no admite más cambios"],
  ROUNDS_BELOW_GENERATED: [409, "El torneo ya tiene {count} rondas generadas: no puede configurarse con menos"],
  TIEBREAKS_LOCKED: [
    409,
    "No se pueden modificar los desempates ni los puntos del bye después de iniciada la primera ronda",
  ],
  REGISTRATION_CANNOT_OPEN: [409, "Solo se pueden abrir las inscripciones de un torneo recién creado"],
  REGISTRATION_CANNOT_CLOSE: [409, "Solo se pueden cerrar las inscripciones mientras están abiertas"],
  REGISTRATION_NOT_OPEN: [409, "El torneo no tiene las inscripciones abiertas"],
  PROGRAM_NOT_ELIGIBLE: [409, 'Este torneo solo admite jugadores del programa "{program}"'],
  SEMESTER_NOT_ELIGIBLE: [409, "Este torneo exige un semestre mínimo de {semester}"],
  ALREADY_ENROLLED: [409, "El jugador ya está inscrito en este torneo"],
  NOT_ACTIVELY_ENROLLED: [404, "El jugador no está inscrito activamente en este torneo"],
  TOURNAMENT_NOT_IN_PROGRESS: [409, "Solo se puede finalizar un torneo en curso"],
  ROUNDS_INCOMPLETE: [
    409,
    "Para finalizar deben estar jugadas y registradas las {total} rondas (completas: {completed})",
  ],

  // Rounds and results
  ROUND_NOT_FOUND: [404, "Ronda no encontrada"],
  REGISTRATION_STILL_OPEN: [409, "Cierra las inscripciones antes de generar la primera ronda"],
  ROUNDS_NOT_CONFIGURED: [409, "Configura el número de rondas del torneo antes de emparejar"],
  DRAFT_PENDING: [409, "La ronda {number} está en borrador: publícala o descártala antes de generar otra"],
  RESULTS_PENDING: [409, "Faltan resultados de la ronda {number}"],
  ALL_ROUNDS_PLAYED: [409, "El torneo ya jugó sus {count} rondas"],
  NOT_ENOUGH_PLAYERS: [409, "Se necesitan al menos 2 jugadores activos para emparejar"],
  PAIRING_IMPOSSIBLE: [409, "No existe un emparejamiento que evite repetir enfrentamientos en la ronda {number}"],
  DISCARD_NEEDS_DRAFT: [409, "Solo se puede descartar una ronda antes de publicarla"],
  ADJUST_NEEDS_DRAFT: [409, "Solo se puede ajustar una ronda antes de publicarla"],
  PUBLISH_NEEDS_DRAFT: [409, "Esta ronda ya fue publicada"],
  SAME_PLAYER_TWICE: [400, "Elige dos jugadores distintos"],
  PLAYER_NOT_IN_ROUND: [404, "Ese jugador no está en esta ronda"],
  WITHDRAWN_PLAYER_SEATED: [
    409,
    "{name} se retiró del torneo después de generar este borrador: descártalo y genera la ronda de nuevo",
  ],
  MATCH_NOT_FOUND: [404, "Partida no encontrada"],
  RESULTS_FORBIDDEN: [403, "Solo un árbitro o el organizador del torneo pueden registrar resultados"],
  ROUND_NOT_PUBLISHED: [409, "La ronda todavía no fue publicada"],
  BYE_HAS_NO_RESULT: [409, "Un bye no lleva resultado"],
  RESULT_ALREADY_RECORDED: [409, "Esta partida ya tiene resultado; para cambiarlo usa la corrección"],
  NO_RESULT_TO_CORRECT: [409, "Esta partida todavía no tiene resultado para corregir"],
  RESULT_UNCHANGED: [409, "El resultado nuevo es igual al registrado"],

  // Official documents and dashboards
  EXPORT_FORBIDDEN: [403, "Solo un árbitro o el organizador del torneo pueden exportar sus documentos oficiales"],
  ROUND_NOT_EXPORTABLE: [409, "Solo se exportan rondas publicadas"],
  WIDGET_NOT_ENABLED: [403, "Este control no está habilitado para tu rol"],
  WIDGET_NEEDS_PLAYER: [400, "Este control necesita un jugador (playerId)"],
  PLAYER_OUT_OF_SCOPE: [403, "No tienes acceso a los datos de este jugador"],
} as const satisfies Record<string, readonly [number, string]>;

export type ApiErrorCode = keyof typeof API_ERRORS;

/** The body of every error response: the catalog code, its message, and details when there are any. */
export interface ApiErrorBody {
  error: string;
  code: ApiErrorCode;
  /** The values that fill the message's placeholders. */
  params?: Record<string, string | number>;
  /** Per-field messages (VALIDATION_FAILED), keyed by the field's path (`player.semester`). */
  fields?: Record<string, string>;
}
