import { api } from "./api";

// Round lifecycle (backend/src/services/rounds.service.ts):
// GENERATED = draft (only its managers see it), RECORDING_RESULTS =
// published, STANDINGS_UPDATED = every game recorded.
export type RoundStatus = "GENERATED" | "RECORDING_RESULTS" | "STANDINGS_UPDATED";

// RN-03: the results a person can record ("BYE" is assigned by the engine only).
export const GAME_RESULTS = ["1-0", "1/2-1/2", "0-1"] as const;
export type GameResult = (typeof GAME_RESULTS)[number];

export interface Seat {
  playerId: string;
  name: string;
}

export interface Match {
  id: string;
  board: number;
  status: string;
  white: Seat | null;
  black: Seat | null;
  result: GameResult | "BYE" | null;
  isBye: boolean;
}

export interface Round {
  id: string;
  number: number;
  status: RoundStatus;
  createdAt: string;
  matches: Match[];
}

export interface StandingRow {
  rank: number;
  playerId: string;
  name: string;
  score: number;
  buchholz: number;
  buchholzCut1: number;
  sonnebornBerger: number;
  withdrawn: boolean;
}

export interface Standings {
  tournamentId: string;
  // True while the latest published round still has games without a result.
  pending: boolean;
  roundsCompleted: number;
  tiebreaks: string[];
  rows: StandingRow[];
}

export interface SwapPayload {
  playerAId: string;
  playerBId: string;
  reason: string;
}

/** The tournament's rounds with their pairings; drafts only come back for its managers (HU18). */
export async function listRounds(tournamentId: string): Promise<Round[]> {
  const { data } = await api.get<Round[]>(`/tournaments/${tournamentId}/rounds`);
  return data;
}

/** Pairs the next round as a draft (HU08). */
export async function generateRound(tournamentId: string): Promise<Round> {
  const { data } = await api.post<Round>(`/tournaments/${tournamentId}/rounds`);
  return data;
}

/** Discards a draft round. */
export async function discardRound(roundId: string): Promise<void> {
  await api.delete(`/rounds/${roundId}`);
}

/** Swaps two players' seats in a draft round (HU29). */
export async function swapPlayers(roundId: string, payload: SwapPayload): Promise<Round> {
  const { data } = await api.post<Round>(`/rounds/${roundId}/swap`, payload);
  return data;
}

/** Publishes a draft round (HU09). */
export async function publishRound(roundId: string): Promise<Round> {
  const { data } = await api.post<Round>(`/rounds/${roundId}/publish`);
  return data;
}

/** Records a game's result (HU10). */
export async function recordResult(matchId: string, value: GameResult): Promise<void> {
  await api.post(`/matches/${matchId}/result`, { value });
}

/** Corrects an already recorded result (HU11). */
export async function correctResult(matchId: string, value: GameResult, reason?: string): Promise<void> {
  await api.put(`/matches/${matchId}/result`, reason ? { value, reason } : { value });
}

/** The tournament's current official standings (HU14). */
export async function getStandings(tournamentId: string): Promise<Standings> {
  const { data } = await api.get<Standings>(`/tournaments/${tournamentId}/standings`);
  return data;
}

export interface BoardResults {
  whiteWins: number;
  draws: number;
  blackWins: number;
}

export interface RoundStats extends BoardResults {
  round: number;
  pending: number;
}

// HU16: backend/src/services/tournamentStats.service.ts
export interface TournamentStats extends BoardResults {
  tournamentId: string;
  activePlayers: number;
  withdrawnPlayers: number;
  gamesPlayed: number;
  byes: number;
  decisiveRate: number | null;
  whiteScoreRate: number | null;
  rounds: RoundStats[];
}

/** Aggregate statistics of the tournament (HU16). */
export async function getTournamentStats(tournamentId: string): Promise<TournamentStats> {
  const { data } = await api.get<TournamentStats>(`/tournaments/${tournamentId}/stats`);
  return data;
}

/** The current standings as a PDF, for arbiters and the organizer (HU30). */
export async function downloadStandingsPdf(tournamentId: string): Promise<Blob> {
  const { data } = await api.get<Blob>(`/tournaments/${tournamentId}/standings.pdf`, { responseType: "blob" });
  return data;
}

/** A published round's pairings as a PDF, for arbiters and the organizer (HU30). */
export async function downloadPairingsPdf(roundId: string): Promise<Blob> {
  const { data } = await api.get<Blob>(`/rounds/${roundId}/pairings.pdf`, { responseType: "blob" });
  return data;
}
