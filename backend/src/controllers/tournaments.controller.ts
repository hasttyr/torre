import { prisma } from "../config/prisma";
import { asyncHandler } from "../middlewares/asyncHandler";
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
  const parsed = createTournamentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  const tournament = await createTournament(prisma, req.user!.id, parsed.data);
  res.status(201).json(tournament);
});

/** GET /tournaments/:id — a single tournament's detail. */
export const get = asyncHandler(async (req, res) => {
  const tournament = await getTournament(prisma, String(req.params.id), req.user!.id, req.user!.role);
  res.status(200).json(tournament);
});

/** PUT /tournaments/:id/configuration — updates rounds, time control, tiebreaks and eligibility. */
export const configure = asyncHandler(async (req, res) => {
  const parsed = configureTournamentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  const tournament = await configureTournament(prisma, String(req.params.id), req.user!.id, req.user!.role, parsed.data);
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
  const parsed = enrollPlayerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  const player = await enrollPlayer(prisma, String(req.params.id), parsed.data.playerId, req.user!.id, req.user!.role);
  res.status(201).json(player);
});

/** GET /tournaments/:id/players — lists the players enrolled in the tournament. */
export const listPlayers = asyncHandler(async (req, res) => {
  const players = await listEnrolledPlayers(prisma, String(req.params.id), req.user!.id, req.user!.role);
  res.status(200).json(players);
});
