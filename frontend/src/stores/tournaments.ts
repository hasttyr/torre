import { defineStore } from "pinia";

import {
  closeRegistration as closeTournamentRegistration,
  configureTournament,
  createTournament,
  enrollPlayer as enrollTournamentPlayer,
  getTournament,
  listEnrolledPlayers,
  listAvailableTournaments,
  listEnrolledTournaments,
  listMyTournaments,
  openRegistration as openTournamentRegistration,
  type ConfigureTournamentPayload,
  type CreateTournamentPayload,
  type EnrolledPlayer,
  type Tournament,
} from "../services/tournaments";

interface TournamentsState {
  current: Tournament | null;
  enrolledPlayers: EnrolledPlayer[];
  mine: Tournament[];
  available: Tournament[];
  enrolled: Tournament[];
}

export const useTournamentsStore = defineStore("tournaments", {
  state: (): TournamentsState => ({
    current: null,
    enrolledPlayers: [],
    mine: [],
    available: [],
    enrolled: [],
  }),
  actions: {
    /** Loads the tournaments the current user organizes. */
    async loadMyTournaments(): Promise<void> {
      this.mine = await listMyTournaments();
    },

    // HU25 + player view: loaded together because they share the same
    // screen ("Available tournaments" and "My registrations" side by side).
    /** Loads both the available tournaments and the ones the current player is enrolled in. */
    async loadPlayerTournaments(): Promise<void> {
      const [available, enrolled] = await Promise.all([listAvailableTournaments(), listEnrolledTournaments()]);
      this.available = available;
      this.enrolled = enrolled;
    },

    /** Creates a new tournament and sets it as the current one. */
    async create(payload: CreateTournamentPayload): Promise<Tournament> {
      const tournament = await createTournament(payload);
      this.current = tournament;
      this.enrolledPlayers = [];
      return tournament;
    },

    /** Loads a tournament by id, along with its enrolled players. */
    async load(id: string): Promise<void> {
      this.current = await getTournament(id);
      this.enrolledPlayers = await listEnrolledPlayers(id);
    },

    /** Updates the current tournament's rounds, time control, tiebreak order and eligibility rules. */
    async configure(id: string, payload: ConfigureTournamentPayload): Promise<void> {
      this.current = await configureTournament(id, payload);
    },

    /** Opens registration for a tournament (HU06). */
    async openRegistration(id: string): Promise<void> {
      this.current = await openTournamentRegistration(id);
    },

    /** Closes registration for a tournament (HU06). */
    async closeRegistration(id: string): Promise<void> {
      this.current = await closeTournamentRegistration(id);
    },

    /** Enrolls a player into a tournament and appends it to the enrolled list (HU07). */
    async enrollPlayer(id: string, playerId: string): Promise<void> {
      const enrolledPlayer = await enrollTournamentPlayer(id, playerId);
      this.enrolledPlayers.push(enrolledPlayer);
    },
  },
});
