import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma";
import { HttpError } from "../middlewares/errorHandler";
import {
  closeRegistration,
  configureTournament,
  createTournament,
  enrollPlayer,
  listEnrolledPlayers,
  listAvailableTournaments,
  listEnrolledTournaments,
  listMyTournaments,
  openRegistration,
  getTournament,
} from "../services/tournaments.service";
import { configureTournamentSchema, createTournamentSchema, enrollPlayerSchema } from "../validators/tournaments.schemas";

function badRequest(next: NextFunction, message: string): void {
  next(new HttpError(400, message));
}

/** GET /tournaments/mine — tournaments the current user organizes. */
export async function listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tournaments = await listMyTournaments(prisma, req.user!.id, req.user!.rol);
    res.status(200).json(tournaments);
  } catch (error) {
    next(error);
  }
}

/** GET /tournaments/available — tournaments currently open for registration. */
export async function listAvailable(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tournaments = await listAvailableTournaments(prisma);
    res.status(200).json(tournaments);
  } catch (error) {
    next(error);
  }
}

/** GET /tournaments/enrolled — tournaments the current user (as a player) is enrolled in. */
export async function listMyEnrollments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tournaments = await listEnrolledTournaments(prisma, req.user!.id);
    res.status(200).json(tournaments);
  } catch (error) {
    next(error);
  }
}

/** POST /tournaments — creates a new tournament owned by the current user. */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = createTournamentSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(next, parsed.error.issues.map((issue) => issue.message).join("; "));
    return;
  }

  try {
    const tournament = await createTournament(prisma, req.user!.id, parsed.data);
    res.status(201).json(tournament);
  } catch (error) {
    next(error);
  }
}

/** GET /tournaments/:id — a single tournament's detail. */
export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tournament = await getTournament(prisma, String(req.params.id), req.user!.id, req.user!.rol);
    res.status(200).json(tournament);
  } catch (error) {
    next(error);
  }
}

/** PUT /tournaments/:id/configuration — updates rounds, time control, tiebreaks and eligibility. */
export async function configure(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = configureTournamentSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(next, parsed.error.issues.map((issue) => issue.message).join("; "));
    return;
  }

  try {
    const tournament = await configureTournament(prisma, String(req.params.id), req.user!.id, req.user!.rol, parsed.data);
    res.status(200).json(tournament);
  } catch (error) {
    next(error);
  }
}

/** POST /tournaments/:id/registration/open — opens registration (HU06). */
export async function open(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tournament = await openRegistration(prisma, String(req.params.id), req.user!.id, req.user!.rol);
    res.status(200).json(tournament);
  } catch (error) {
    next(error);
  }
}

/** POST /tournaments/:id/registration/close — closes registration (HU06). */
export async function close(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tournament = await closeRegistration(prisma, String(req.params.id), req.user!.id, req.user!.rol);
    res.status(200).json(tournament);
  } catch (error) {
    next(error);
  }
}

/** POST /tournaments/:id/players — enrolls a player into the tournament (HU07). */
export async function enroll(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = enrollPlayerSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(next, parsed.error.issues.map((issue) => issue.message).join("; "));
    return;
  }

  try {
    const player = await enrollPlayer(
      prisma,
      String(req.params.id),
      parsed.data.playerId,
      req.user!.id,
      req.user!.rol,
    );
    res.status(201).json(player);
  } catch (error) {
    next(error);
  }
}

/** GET /tournaments/:id/players — lists the players enrolled in the tournament. */
export async function listPlayers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const players = await listEnrolledPlayers(prisma, String(req.params.id), req.user!.id, req.user!.rol);
    res.status(200).json(players);
  } catch (error) {
    next(error);
  }
}
