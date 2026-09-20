import { defineStore } from "pinia";

import {
  linkPlayer as linkPlayerRequest,
  listCoachTournaments,
  listLinkedPlayers,
  unlinkPlayer,
  type CoachTournament,
  type LinkedPlayer,
} from "../services/coaches";

interface CoachesState {
  linkedPlayers: LinkedPlayer[];
  tournaments: CoachTournament[];
}

export const useCoachesStore = defineStore("coaches", {
  state: (): CoachesState => ({
    linkedPlayers: [],
    tournaments: [],
  }),
  actions: {
    /** Loads the players the current coach is linked to (HU24). */
    async loadLinkedPlayers(): Promise<void> {
      this.linkedPlayers = await listLinkedPlayers();
    },

    /** Loads the tournaments where the coach's linked players are enrolled. */
    async loadTournaments(): Promise<void> {
      this.tournaments = await listCoachTournaments();
    },

    /** Links a player and appends it to the list. */
    async linkPlayer(playerId: string): Promise<void> {
      const player = await linkPlayerRequest(playerId);
      this.linkedPlayers.push(player);
    },

    /** Unlinks a player and removes it from the list. */
    async unlinkPlayer(playerId: string): Promise<void> {
      await unlinkPlayer(playerId);
      this.linkedPlayers = this.linkedPlayers.filter((p) => p.playerId !== playerId);
    },
  },
});
