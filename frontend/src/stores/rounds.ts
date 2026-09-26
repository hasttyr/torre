import { defineStore } from "pinia";

import {
  correctResult,
  discardRound,
  generateRound,
  getStandings,
  getTournamentStats,
  listRounds,
  publishRound,
  recordResult,
  swapPlayers,
  type GameResult,
  type Round,
  type Standings,
  type SwapPayload,
  type TournamentStats,
} from "../services/rounds";

interface RoundsState {
  tournamentId: string | null;
  rounds: Round[];
  standings: Standings | null;
  stats: TournamentStats | null;
}

// One tournament's competitive state (rounds, standings, statistics), shared by the
// organizer's round manager and the live tournament room. Every change is
// followed by a full refresh from the server: the backend recalculates
// standings and round status, so re-deriving them here would duplicate rules.
export const useRoundsStore = defineStore("rounds", {
  state: (): RoundsState => ({
    tournamentId: null,
    rounds: [],
    standings: null,
    stats: null,
  }),
  getters: {
    /** The round still in draft (at most one), if any. */
    draft: (state): Round | null => state.rounds.find((round) => round.status === "GENERATED") ?? null,
  },
  actions: {
    /** Starts following a tournament and loads its rounds and standings. */
    async load(tournamentId: string): Promise<void> {
      this.tournamentId = tournamentId;
      this.rounds = [];
      this.standings = null;
      this.stats = null;
      await this.refresh();
    },

    /** Re-reads rounds, standings and statistics from the server (after a change, or a real-time event). */
    async refresh(): Promise<void> {
      const tournamentId = this.tournamentId;
      if (!tournamentId) return;
      const [rounds, standings, stats] = await Promise.all([
        listRounds(tournamentId),
        getStandings(tournamentId),
        getTournamentStats(tournamentId),
      ]);
      // The viewer may have moved to another tournament while this was in
      // flight: a late answer must not overwrite the new one's data.
      if (this.tournamentId !== tournamentId) return;
      this.rounds = rounds;
      this.standings = standings;
      this.stats = stats;
    },

    async generate(): Promise<void> {
      await generateRound(this.tournamentId!);
      await this.refresh();
    },

    async discard(roundId: string): Promise<void> {
      await discardRound(roundId);
      await this.refresh();
    },

    async swap(roundId: string, payload: SwapPayload): Promise<void> {
      await swapPlayers(roundId, payload);
      await this.refresh();
    },

    async publish(roundId: string): Promise<void> {
      await publishRound(roundId);
      await this.refresh();
    },

    async record(matchId: string, value: GameResult): Promise<void> {
      await recordResult(matchId, value);
      await this.refresh();
    },

    async correct(matchId: string, value: GameResult, reason?: string): Promise<void> {
      await correctResult(matchId, value, reason);
      await this.refresh();
    },
  },
});
