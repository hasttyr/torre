import type { PrismaClient } from "@prisma/client";

import { HttpError } from "../middlewares/errorHandler";
import type { ConfigurarTorneoSchemaInput, CrearTorneoSchemaInput } from "../validators/torneos.schemas";
import { toTorneoDto, type TorneoDto } from "./torneo.mapper";

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

// El organizador solo administra sus propios torneos; un administrador
// puede intervenir cualquiera (mismo criterio que updateUserRole en
// users.service.ts, que reserva el cambio de rol a ADMINISTRADOR).
function assertPuedeAdministrar(torneo: { organizadorId: string }, userId: string, rol: string): void {
  if (rol !== "ADMINISTRADOR" && torneo.organizadorId !== userId) {
    throw new HttpError(403, "No tenés permiso para administrar este torneo");
  }
}

export async function crearTorneo(
  prisma: PrismaClient,
  organizadorId: string,
  data: CrearTorneoSchemaInput,
): Promise<TorneoDto> {
  const torneo = await prisma.torneo.create({
    data: {
      nombre: data.nombre.trim(),
      fechaInicio: data.fechaInicio,
      fechaFin: data.fechaFin,
      formato: data.formato?.trim() ?? "suizo",
      organizadorId,
    },
    include: { criteriosDesempate: true },
  });

  return toTorneoDto(torneo);
}

// HU26 (adelantada de S11 a S6, junto con Inscripcion): sin esto no hay
// forma de volver a encontrar un torneo ya creado desde la UI salvo
// guardarse el link a mano. Un organizador ve solo lo suyo; un
// administrador ve todos (mismo criterio que assertPuedeAdministrar).
export async function listarMisTorneos(prisma: PrismaClient, userId: string, rol: string): Promise<TorneoDto[]> {
  const torneos = await prisma.torneo.findMany({
    where: rol === "ADMINISTRADOR" ? {} : { organizadorId: userId },
    include: { criteriosDesempate: true },
    orderBy: { createdAt: "desc" },
  });
  return torneos.map(toTorneoDto);
}

// HU25 (adelantada de S11 a S6): listado que ve un jugador para decidir a
// qué torneo inscribirse. Solo estado INSCRIPCIONES_ABIERTAS cuenta como
// "disponible" (CA: "un torneo finalizado o privado no aparece"); CREADO
// todavía no acepta inscripciones así que tampoco se lista.
export async function listarTorneosDisponibles(prisma: PrismaClient): Promise<TorneoDto[]> {
  const torneos = await prisma.torneo.findMany({
    where: { estado: "INSCRIPCIONES_ABIERTAS" },
    include: { criteriosDesempate: true },
    orderBy: { fechaInicio: "asc" },
  });
  return torneos.map(toTorneoDto);
}

// Torneos donde el usuario autenticado está inscrito como jugador,
// independientemente de quién haya hecho la inscripción (hoy siempre el
// organizador, ver HU07). Un usuario sin perfil de Jugador (p. ej. rol
// ORGANIZADOR) simplemente no tiene inscripciones.
export async function listarTorneosInscritoJugador(prisma: PrismaClient, usuarioId: string): Promise<TorneoDto[]> {
  const jugador = await prisma.jugador.findUnique({ where: { usuarioId } });
  if (!jugador) {
    return [];
  }

  const inscripciones = await prisma.inscripcion.findMany({
    where: { jugadorId: jugador.id },
    include: { torneo: { include: { criteriosDesempate: true } } },
    orderBy: { createdAt: "desc" },
  });

  return inscripciones.map((inscripcion) => toTorneoDto(inscripcion.torneo));
}

// Restringido a organizador-dueño/administrador: hasta que exista HU18
// (consulta filtrada por rol), el detalle de un torneo específico —y el
// roster de HU07 en listarJugadoresInscritos, que expone datos
// personales— solo lo ve quien lo administra. Ver GET /torneos/disponibles
// y /torneos/inscrito para lo que sí puede consultar cualquier rol.
export async function obtenerTorneo(
  prisma: PrismaClient,
  torneoId: string,
  userId: string,
  rol: string,
): Promise<TorneoDto> {
  const torneo = await prisma.torneo.findUnique({
    where: { id: torneoId },
    include: { criteriosDesempate: true },
  });
  if (!torneo) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertPuedeAdministrar(torneo, userId, rol);
  return toTorneoDto(torneo);
}

export async function configurarTorneo(
  prisma: PrismaClient,
  torneoId: string,
  userId: string,
  rol: string,
  data: ConfigurarTorneoSchemaInput,
): Promise<TorneoDto> {
  const torneo = await prisma.torneo.findUnique({ where: { id: torneoId } });
  if (!torneo) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertPuedeAdministrar(torneo, userId, rol);

  if (data.criteriosDesempate) {
    // RN-05: el orden de desempates solo puede modificarse en estado
    // preliminar del torneo, es decir antes de que exista la ronda 1.
    const primeraRonda = await prisma.ronda.findFirst({ where: { torneoId, numero: 1 } });
    if (primeraRonda) {
      throw new HttpError(409, "No se puede modificar el orden de desempates después de iniciada la primera ronda");
    }
  }

  const actualizado = await prisma.$transaction(async (tx) => {
    if (data.criteriosDesempate) {
      await tx.criterioDesempate.deleteMany({ where: { torneoId } });
      if (data.criteriosDesempate.length > 0) {
        await tx.criterioDesempate.createMany({
          data: data.criteriosDesempate.map((criterio) => ({
            torneoId,
            nombre: criterio.nombre,
            orden: criterio.orden,
          })),
        });
      }
    }

    return tx.torneo.update({
      where: { id: torneoId },
      data: {
        ...(data.numeroRondas !== undefined ? { numeroRondas: data.numeroRondas } : {}),
        ...(data.ritmo !== undefined ? { ritmo: data.ritmo } : {}),
        ...(data.programaRestringido !== undefined ? { programaRestringido: data.programaRestringido } : {}),
        ...(data.semestreMinimo !== undefined ? { semestreMinimo: data.semestreMinimo } : {}),
      },
      include: { criteriosDesempate: true },
    });
  });

  return toTorneoDto(actualizado);
}

const TRANSICIONES_INSCRIPCION = {
  abrir: { desde: "CREADO", hacia: "INSCRIPCIONES_ABIERTAS" },
  cerrar: { desde: "INSCRIPCIONES_ABIERTAS", hacia: "INSCRIPCIONES_CERRADAS" },
} as const;

async function transicionarInscripcion(
  prisma: PrismaClient,
  torneoId: string,
  userId: string,
  rol: string,
  accion: keyof typeof TRANSICIONES_INSCRIPCION,
): Promise<TorneoDto> {
  const torneo = await prisma.torneo.findUnique({ where: { id: torneoId } });
  if (!torneo) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertPuedeAdministrar(torneo, userId, rol);

  const { desde, hacia } = TRANSICIONES_INSCRIPCION[accion];
  if (torneo.estado !== desde) {
    throw new HttpError(
      409,
      `No se puede pasar de "${torneo.estado}" a "${hacia}": se requiere estado "${desde}"`,
    );
  }

  const actualizado = await prisma.torneo.update({
    where: { id: torneoId },
    data: { estado: hacia },
    include: { criteriosDesempate: true },
  });

  return toTorneoDto(actualizado);
}

export function abrirInscripciones(
  prisma: PrismaClient,
  torneoId: string,
  userId: string,
  rol: string,
): Promise<TorneoDto> {
  return transicionarInscripcion(prisma, torneoId, userId, rol, "abrir");
}

export function cerrarInscripciones(
  prisma: PrismaClient,
  torneoId: string,
  userId: string,
  rol: string,
): Promise<TorneoDto> {
  return transicionarInscripcion(prisma, torneoId, userId, rol, "cerrar");
}

export interface JugadorInscritoDto {
  jugadorId: string;
  nombre: string;
  codigoUniversitario: string;
  programa: string;
  semestre: number;
  inscritoEn: Date;
}

export async function inscribirJugador(
  prisma: PrismaClient,
  torneoId: string,
  jugadorId: string,
  userId: string,
  rol: string,
): Promise<JugadorInscritoDto> {
  const torneo = await prisma.torneo.findUnique({ where: { id: torneoId } });
  if (!torneo) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertPuedeAdministrar(torneo, userId, rol);

  // CA HU06: al cerrar inscripciones, nuevos registros son rechazados.
  if (torneo.estado !== "INSCRIPCIONES_ABIERTAS") {
    throw new HttpError(409, "El torneo no tiene las inscripciones abiertas");
  }

  const jugador = await prisma.jugador.findUnique({ where: { id: jugadorId }, include: { usuario: true } });
  if (!jugador) {
    throw new HttpError(404, "Jugador no encontrado");
  }

  // Elegibilidad configurada en HU05 (programaRestringido/semestreMinimo):
  // se valida acá, no en el schema de zod, porque depende de datos del
  // torneo y del jugador, no solo de la forma del payload.
  if (torneo.programaRestringido && jugador.programa !== torneo.programaRestringido) {
    throw new HttpError(
      409,
      `Este torneo solo admite jugadores del programa "${torneo.programaRestringido}"`,
    );
  }
  if (torneo.semestreMinimo != null && jugador.semestre < torneo.semestreMinimo) {
    throw new HttpError(409, `Este torneo exige un semestre mínimo de ${torneo.semestreMinimo}`);
  }

  try {
    const inscripcion = await prisma.inscripcion.create({
      data: { torneoId, jugadorId },
    });
    return {
      jugadorId: jugador.id,
      nombre: jugador.usuario.nombre,
      codigoUniversitario: jugador.codigoUniversitario,
      programa: jugador.programa,
      semestre: jugador.semestre,
      inscritoEn: inscripcion.createdAt,
    };
  } catch (error) {
    // RN-01: un jugador no puede ser inscrito dos veces en el mismo torneo.
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "El jugador ya está inscrito en este torneo");
    }
    throw error;
  }
}

export async function listarJugadoresInscritos(
  prisma: PrismaClient,
  torneoId: string,
  userId: string,
  rol: string,
): Promise<JugadorInscritoDto[]> {
  const torneo = await prisma.torneo.findUnique({ where: { id: torneoId } });
  if (!torneo) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertPuedeAdministrar(torneo, userId, rol);

  const inscripciones = await prisma.inscripcion.findMany({
    where: { torneoId },
    include: { jugador: { include: { usuario: true } } },
    orderBy: { createdAt: "asc" },
  });

  return inscripciones.map((inscripcion) => ({
    jugadorId: inscripcion.jugador.id,
    nombre: inscripcion.jugador.usuario.nombre,
    codigoUniversitario: inscripcion.jugador.codigoUniversitario,
    programa: inscripcion.jugador.programa,
    semestre: inscripcion.jugador.semestre,
    inscritoEn: inscripcion.createdAt,
  }));
}
