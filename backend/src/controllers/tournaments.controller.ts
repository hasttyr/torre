import { prisma } from "../config/prisma";
import { asyncHandler } from "../middlewares/asyncHandler";
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
export const listMine = asyncHandler(async (req, res) => {
  const tournaments = await listMyTournaments(prisma, req.user!.id, req.user!.role);
  res.status(200).json(tournaments);
});

/** GET /tournaments/available — tournaments currently open for registration. */
export const listAvailable = asyncHandler(async (_req, res) => {
  const tournaments = await listAvailableTournaments(prisma);
  res.status(200).json(tournaments);
});

/** GET /tournaments/enrolled — tournaments the current user (as a player) is enrolled in. */
export const listMyEnrollments = asyncHandler(async (req, res) => {
  const tournaments = await listEnrolledTournaments(prisma, req.user!.id);
  res.status(200).json(tournaments);
});

/** POST /tournaments — creates a new tournament owned by the current user. */
export const create = asyncHandler(async (req, res) => {
  const input = parseOrThrow(createTournamentSchema, req.body);

  const tournament = await createTournament(prisma, req.user!.id, input);
  res.status(201).json(tournament);
});

/** GET /tournaments/:id — a single tournament's detail. */
export const get = asyncHandler(async (req, res) => {
  const tournament = await getTournament(prisma, String(req.params.id), req.user!.id, req.user!.role);
  res.status(200).json(tournament);
});

/** PUT /tournaments/:id/configuration — updates rounds, time control, tiebreaks and eligibility. */
export const configure = asyncHandler(async (req, res) => {
  const input = parseOrThrow(configureTournamentSchema, req.body);

  const tournament = await configureTournament(prisma, String(req.params.id), req.user!.id, req.user!.role, input);
  res.status(200).json(tournament);
});

/** POST /tournaments/:id/registration/open — opens registration (HU06). */
export const open = asyncHandler(async (req, res) => {
  const tournament = await openRegistration(prisma, String(req.params.id), req.user!.id, req.user!.role);
  res.status(200).json(tournament);
});

/** POST /tournaments/:id/registration/close — closes registration (HU06). */
export const close = asyncHandler(async (req, res) => {
  const tournament = await closeRegistration(prisma, String(req.params.id), req.user!.id, req.user!.role);
  res.status(200).json(tournament);
});

/** POST /tournaments/:id/players — enrolls a player into the tournament (HU07). */
export const enroll = asyncHandler(async (req, res) => {
  const input = parseOrThrow(enrollPlayerSchema, req.body);

  const player = await enrollPlayer(prisma, String(req.params.id), input.playerId, req.user!.id, req.user!.role);
  res.status(201).json(player);
});

/** GET /tournaments/:id/players — lists the players enrolled in the tournament. */
export const listPlayers = asyncHandler(async (req, res) => {
  const players = await listEnrolledPlayers(prisma, String(req.params.id), req.user!.id, req.user!.role);
  res.status(200).json(players);
});

/** POST /tournaments/:id/players/:playerId/withdraw — withdraws a player from the tournament (HU27). */
export const withdraw = asyncHandler(async (req, res) => {
  const input = parseOrThrow(withdrawPlayerSchema, req.body);

  await withdrawPlayer(prisma, String(req.params.id), String(req.params.playerId), req.user!.id, req.user!.role, input);
  res.status(204).send();
});

/** GET /tournaments/live — tournaments in progress or finished, for anyone to follow (HU18). */
export const listLive = asyncHandler(async (_req, res) => {
  res.status(200).json(await listLiveTournaments(prisma));
});

/** GET /tournaments/:id/standings — current official standings (HU12-HU14). */
export const standings = asyncHandler(async (req, res) => {
  res.status(200).json(await getStandings(prisma, String(req.params.id), req.user!));
});

/** POST /tournaments/:id/finish — officially closes the tournament (HU17). */
export const finish = asyncHandler(async (req, res) => {
  res.status(200).json(await finishTournament(prisma, String(req.params.id), req.user!));
});

/** GET /tournaments/:id/stats — aggregate statistics of the tournament (HU16). */
export const stats = asyncHandler(async (req, res) => {
  res.status(200).json(await getTournamentStats(prisma, String(req.params.id), req.user!));
});
