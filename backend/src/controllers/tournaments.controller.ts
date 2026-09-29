import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { actorOf } from "../middlewares/auth";
import {
  closeRegistration,
  configureTournament,
  createTournament,
  enrollPlayer,
  finishTournament,
  listEnrolledPlayers,
  listAvailableTournaments,
  listEnrolledTournaments,
  listLiveTournaments,
  listMyTournaments,
  openRegistration,
  getTournament,
  withdrawPlayer,
} from "../services/tournaments.service";
import { getStandings } from "../services/standings.service";
import { getTournamentStats } from "../services/tournamentStats.service";
import {
  configureTournamentSchema,
  createTournamentSchema,
  enrollPlayerSchema,
  withdrawPlayerSchema,
} from "../validators/tournaments.schemas";
import { idParam } from "../validators/params";
import { parseOrThrow } from "../validators/parse";

/** GET /tournaments/mine — tournaments the current user organizes. */
export async function listMine(req: Request, res: Response): Promise<void> {
  res.status(200).json(await listMyTournaments(prisma, actorOf(req)));
}

/** GET /tournaments/available — tournaments currently open for registration. */
export async function listAvailable(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await listAvailableTournaments(prisma));
}

/** GET /tournaments/enrolled — tournaments the current user (as a player) is enrolled in. */
export async function listMyEnrollments(req: Request, res: Response): Promise<void> {
  res.status(200).json(await listEnrolledTournaments(prisma, actorOf(req)));
}

/** POST /tournaments — creates a new tournament owned by the current user. */
export async function create(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(createTournamentSchema, req.body);
  res.status(201).json(await createTournament(prisma, input, actorOf(req)));
}

/** GET /tournaments/:id — a single tournament's detail. */
export async function get(req: Request, res: Response): Promise<void> {
  res.status(200).json(await getTournament(prisma, idParam(req, "id"), actorOf(req)));
}

/** PUT /tournaments/:id/configuration — updates rounds, time control, tiebreaks and eligibility. */
export async function configure(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(configureTournamentSchema, req.body);
  res.status(200).json(await configureTournament(prisma, idParam(req, "id"), input, actorOf(req)));
}

/** POST /tournaments/:id/registration/open — opens registration (HU06). */
export async function open(req: Request, res: Response): Promise<void> {
  res.status(200).json(await openRegistration(prisma, idParam(req, "id"), actorOf(req)));
}

/** POST /tournaments/:id/registration/close — closes registration (HU06). */
export async function close(req: Request, res: Response): Promise<void> {
  res.status(200).json(await closeRegistration(prisma, idParam(req, "id"), actorOf(req)));
}

/** POST /tournaments/:id/players — enrolls a player into the tournament (HU07). */
export async function enroll(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(enrollPlayerSchema, req.body);
  res.status(201).json(await enrollPlayer(prisma, idParam(req, "id"), input.playerId, actorOf(req)));
}

/** GET /tournaments/:id/players — lists the players enrolled in the tournament. */
export async function listPlayers(req: Request, res: Response): Promise<void> {
  res.status(200).json(await listEnrolledPlayers(prisma, idParam(req, "id"), actorOf(req)));
}

/** POST /tournaments/:id/players/:playerId/withdraw — withdraws a player from the tournament (HU27). */
export async function withdraw(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(withdrawPlayerSchema, req.body);
  await withdrawPlayer(prisma, idParam(req, "id"), idParam(req, "playerId"), input, actorOf(req));
  res.status(204).send();
}

/** GET /tournaments/live — tournaments in progress or finished, for anyone to follow (HU18). */
export async function listLive(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await listLiveTournaments(prisma));
}

/** GET /tournaments/:id/standings — current official standings (HU12-HU14). */
export async function standings(req: Request, res: Response): Promise<void> {
  res.status(200).json(await getStandings(prisma, idParam(req, "id"), actorOf(req)));
}

/** POST /tournaments/:id/finish — officially closes the tournament (HU17). */
export async function finish(req: Request, res: Response): Promise<void> {
  res.status(200).json(await finishTournament(prisma, idParam(req, "id"), actorOf(req)));
}

/** GET /tournaments/:id/stats — aggregate statistics of the tournament (HU16). */
export async function stats(req: Request, res: Response): Promise<void> {
  res.status(200).json(await getTournamentStats(prisma, idParam(req, "id"), actorOf(req)));
}
