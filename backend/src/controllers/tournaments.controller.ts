import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
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
import { parseOrThrow } from "../validators/parse";

/** GET /tournaments/mine — tournaments the current user organizes. */
export async function listMine(req: Request, res: Response): Promise<void> {
  const tournaments = await listMyTournaments(prisma, req.user!.id, req.user!.role);
  res.status(200).json(tournaments);
}

/** GET /tournaments/available — tournaments currently open for registration. */
export async function listAvailable(_req: Request, res: Response): Promise<void> {
  const tournaments = await listAvailableTournaments(prisma);
  res.status(200).json(tournaments);
}

/** GET /tournaments/enrolled — tournaments the current user (as a player) is enrolled in. */
export async function listMyEnrollments(req: Request, res: Response): Promise<void> {
  const tournaments = await listEnrolledTournaments(prisma, req.user!.id);
  res.status(200).json(tournaments);
}

/** POST /tournaments — creates a new tournament owned by the current user. */
export async function create(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(createTournamentSchema, req.body);

  const tournament = await createTournament(prisma, req.user!.id, input);
  res.status(201).json(tournament);
}

/** GET /tournaments/:id — a single tournament's detail. */
export async function get(req: Request, res: Response): Promise<void> {
  const tournament = await getTournament(prisma, String(req.params.id), req.user!.id, req.user!.role);
  res.status(200).json(tournament);
}

/** PUT /tournaments/:id/configuration — updates rounds, time control, tiebreaks and eligibility. */
export async function configure(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(configureTournamentSchema, req.body);

  const tournament = await configureTournament(prisma, String(req.params.id), req.user!.id, req.user!.role, input);
  res.status(200).json(tournament);
}

/** POST /tournaments/:id/registration/open — opens registration (HU06). */
export async function open(req: Request, res: Response): Promise<void> {
  const tournament = await openRegistration(prisma, String(req.params.id), req.user!.id, req.user!.role);
  res.status(200).json(tournament);
}

/** POST /tournaments/:id/registration/close — closes registration (HU06). */
export async function close(req: Request, res: Response): Promise<void> {
  const tournament = await closeRegistration(prisma, String(req.params.id), req.user!.id, req.user!.role);
  res.status(200).json(tournament);
}

/** POST /tournaments/:id/players — enrolls a player into the tournament (HU07). */
export async function enroll(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(enrollPlayerSchema, req.body);

  const player = await enrollPlayer(prisma, String(req.params.id), input.playerId, req.user!.id, req.user!.role);
  res.status(201).json(player);
}

/** GET /tournaments/:id/players — lists the players enrolled in the tournament. */
export async function listPlayers(req: Request, res: Response): Promise<void> {
  const players = await listEnrolledPlayers(prisma, String(req.params.id), req.user!.id, req.user!.role);
  res.status(200).json(players);
}

/** POST /tournaments/:id/players/:playerId/withdraw — withdraws a player from the tournament (HU27). */
export async function withdraw(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(withdrawPlayerSchema, req.body);

  await withdrawPlayer(prisma, String(req.params.id), String(req.params.playerId), req.user!.id, req.user!.role, input);
  res.status(204).send();
}

/** GET /tournaments/live — tournaments in progress or finished, for anyone to follow (HU18). */
export async function listLive(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await listLiveTournaments(prisma));
}

/** GET /tournaments/:id/standings — current official standings (HU12-HU14). */
export async function standings(req: Request, res: Response): Promise<void> {
  res.status(200).json(await getStandings(prisma, String(req.params.id), req.user!));
}

/** POST /tournaments/:id/finish — officially closes the tournament (HU17). */
export async function finish(req: Request, res: Response): Promise<void> {
  res.status(200).json(await finishTournament(prisma, String(req.params.id), req.user!));
}

/** GET /tournaments/:id/stats — aggregate statistics of the tournament (HU16). */
export async function stats(req: Request, res: Response): Promise<void> {
  res.status(200).json(await getTournamentStats(prisma, String(req.params.id), req.user!));
}
