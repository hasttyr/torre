import { defineStore } from "pinia";

import {
  assignPlayerToClub,
  createClub as createClubRequest,
  deleteClub as deleteClubRequest,
  listClubPlayers,
  listClubs,
  removePlayerFromClub,
  updateClub as updateClubRequest,
  type Club,
  type ClubPlayer,
} from "../services/clubs";

interface ClubsState {
  clubs: Club[];
  players: ClubPlayer[];
}

export const useClubsStore = defineStore("clubs", {
  state: (): ClubsState => ({
    clubs: [],
    players: [],
  }),
  actions: {
    /** Loads all clubs (HU23). */
    async loadClubs(): Promise<void> {
      this.clubs = await listClubs();
    },

    /** Creates a new club and appends it to the list. */
    async createClub(name: string): Promise<Club> {
      const club = await createClubRequest(name);
      this.clubs.push(club);
      return club;
    },

    /** Renames a club in place. */
    async updateClub(id: string, name: string): Promise<void> {
      const club = await updateClubRequest(id, name);
      const index = this.clubs.findIndex((c) => c.id === id);
      if (index !== -1) {
        this.clubs[index] = club;
      }
    },

    /** Deletes a club and removes it from the list. */
    async deleteClub(id: string): Promise<void> {
      await deleteClubRequest(id);
      this.clubs = this.clubs.filter((club) => club.id !== id);
    },

    /** Loads the players belonging to a club. */
    async loadPlayers(clubId: string): Promise<void> {
      this.players = await listClubPlayers(clubId);
    },

    /** Associates a player with a club and appends it to the loaded roster. */
    async assignPlayer(clubId: string, playerId: string): Promise<void> {
      const player = await assignPlayerToClub(clubId, playerId);
      this.players.push(player);
    },

    /** Removes a player from a club and from the loaded roster. */
    async removePlayer(clubId: string, playerId: string): Promise<void> {
      await removePlayerFromClub(clubId, playerId);
      this.players = this.players.filter((p) => p.playerId !== playerId);
    },
  },
});
