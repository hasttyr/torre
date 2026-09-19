import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma";
import { HttpError } from "../middlewares/errorHandler";
import {
  abrirInscripciones,
  cerrarInscripciones,
  configurarTorneo,
  crearTorneo,
  inscribirJugador,
  listarJugadoresInscritos,
  listarMisTorneos,
  listarTorneosDisponibles,
  listarTorneosInscritoJugador,
  obtenerTorneo,
} from "../services/torneos.service";
import { configurarTorneoSchema, crearTorneoSchema, inscribirJugadorSchema } from "../validators/torneos.schemas";

function badRequest(next: NextFunction, message: string): void {
  next(new HttpError(400, message));
}

export async function misTorneos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const torneos = await listarMisTorneos(prisma, req.user!.id, req.user!.rol);
    res.status(200).json(torneos);
  } catch (error) {
    next(error);
  }
}

export async function disponibles(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const torneos = await listarTorneosDisponibles(prisma);
    res.status(200).json(torneos);
  } catch (error) {
    next(error);
  }
}

export async function misInscripciones(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const torneos = await listarTorneosInscritoJugador(prisma, req.user!.id);
    res.status(200).json(torneos);
  } catch (error) {
    next(error);
  }
}

export async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = crearTorneoSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(next, parsed.error.issues.map((issue) => issue.message).join("; "));
    return;
  }

  try {
    const torneo = await crearTorneo(prisma, req.user!.id, parsed.data);
    res.status(201).json(torneo);
  } catch (error) {
    next(error);
  }
}

export async function obtener(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const torneo = await obtenerTorneo(prisma, String(req.params.id), req.user!.id, req.user!.rol);
    res.status(200).json(torneo);
  } catch (error) {
    next(error);
  }
}

export async function configurar(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = configurarTorneoSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(next, parsed.error.issues.map((issue) => issue.message).join("; "));
    return;
  }

  try {
    const torneo = await configurarTorneo(prisma, String(req.params.id), req.user!.id, req.user!.rol, parsed.data);
    res.status(200).json(torneo);
  } catch (error) {
    next(error);
  }
}

export async function abrir(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const torneo = await abrirInscripciones(prisma, String(req.params.id), req.user!.id, req.user!.rol);
    res.status(200).json(torneo);
  } catch (error) {
    next(error);
  }
}

export async function cerrar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const torneo = await cerrarInscripciones(prisma, String(req.params.id), req.user!.id, req.user!.rol);
    res.status(200).json(torneo);
  } catch (error) {
    next(error);
  }
}

export async function inscribir(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = inscribirJugadorSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(next, parsed.error.issues.map((issue) => issue.message).join("; "));
    return;
  }

  try {
    const jugador = await inscribirJugador(
      prisma,
      String(req.params.id),
      parsed.data.jugadorId,
      req.user!.id,
      req.user!.rol,
    );
    res.status(201).json(jugador);
  } catch (error) {
    next(error);
  }
}

export async function listarJugadores(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const jugadores = await listarJugadoresInscritos(prisma, String(req.params.id), req.user!.id, req.user!.rol);
    res.status(200).json(jugadores);
  } catch (error) {
    next(error);
  }
}
