import {
  GAME_RESULTS,
  type BoardResults as BoardResultsDto,
  type GameResult,
  type MatchDto,
  type RoundDto,
  type RoundStatsDto,
  type RoundStatus,
  type SeatDto,
  type StandingRowDto,
  type StandingsDto,
  type TournamentStatsDto,
} from "@contracts";

import type { Serialized } from "../lib/serialized";
import { api, path } from "./api";

export { GAME_RESULTS, type GameResult, type RoundStatus };
export type Seat = Serialized<SeatDto>;
export type Match = Serialized<MatchDto>;
export type Round = Serialized<RoundDto>;
export type StandingRow = Serialized<StandingRowDto>;
export type Standings = Serialized<StandingsDto>;
export type BoardResults = Serialized<BoardResultsDto>;
export type RoundStats = Serialized<RoundStatsDto>;
export type TournamentStats = Serialized<TournamentStatsDto>;

export interface SwapPayload {
  playerAId: string;
  playerBId: string;
  reason: string;
}

/** The tournament's rounds with their pairings; drafts only come back for its managers (HU18). */
export async function listRounds(tournamentId: string): Promise<Round[]> {
  const { data } = await api.get<Round[]>(path`/tournaments/${tournamentId}/rounds`);
  return data;
}

/** Pairs the next round as a draft (HU08). */
export async function generateRound(tournamentId: string): Promise<Round> {
  const { data } = await api.post<Round>(path`/tournaments/${tournamentId}/rounds`);
  return data;
}

/** Discards a draft round. */
export async function discardRound(roundId: string): Promise<void> {
  await api.delete(path`/rounds/${roundId}`);
}

/** Swaps two players' seats in a draft round (HU29). */
export async function swapPlayers(roundId: string, payload: SwapPayload): Promise<Round> {
  const { data } = await api.post<Round>(path`/rounds/${roundId}/swap`, payload);
  return data;
}

/** Publishes a draft round (HU09). */
export async function publishRound(roundId: string): Promise<Round> {
  const { data } = await api.post<Round>(path`/rounds/${roundId}/publish`);
  return data;
}

/** Records a game's result (HU10). */
export async function recordResult(matchId: string, value: GameResult): Promise<void> {
  await api.post(path`/matches/${matchId}/result`, { value });
}

/** Corrects an already recorded result (HU11). */
export async function correctResult(matchId: string, value: GameResult, reason?: string): Promise<void> {
  await api.put(path`/matches/${matchId}/result`, reason ? { value, reason } : { value });
}

/** The tournament's current official standings (HU14). */
export async function getStandings(tournamentId: string): Promise<Standings> {
  const { data } = await api.get<Standings>(path`/tournaments/${tournamentId}/standings`);
  return data;
}

/** Aggregate statistics of the tournament (HU16). */
export async function getTournamentStats(tournamentId: string): Promise<TournamentStats> {
  const { data } = await api.get<TournamentStats>(path`/tournaments/${tournamentId}/stats`);
  return data;
}

/** The current standings as a PDF, for arbiters and the organizer (HU30). */
export async function downloadStandingsPdf(tournamentId: string): Promise<Blob> {
  const { data } = await api.get<Blob>(path`/tournaments/${tournamentId}/standings.pdf`, { responseType: "blob" });
  return data;
}

/** A published round's pairings as a PDF, for arbiters and the organizer (HU30). */
export async function downloadPairingsPdf(roundId: string): Promise<Blob> {
  const { data } = await api.get<Blob>(path`/rounds/${roundId}/pairings.pdf`, { responseType: "blob" });
  return data;
}
