import { computeStandings, type RecordedGame } from "../standings.calculator";
import type { Color, PairingCandidate } from "./swissPairing";

// Pure glue between what's stored (games already played) and what the
// pairing engine needs (each player's score, opponents, colors and byes).
// Shared by rounds.service.ts and the seeder, so both pair from the same facts.

export interface PlayedGame extends RecordedGame {
  round: number;
}

/**
 * HU08: the round-1 draw. Shuffles the players (Fisher-Yates) and gives each
 * one a pairing number, 1 = first.
 *
 * @param random - Injectable for reproducible draws (tests, seeder).
 */
export function drawPairingNumbers(playerIds: string[], random: () => number = Math.random): Map<string, number> {
  const order = [...playerIds];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return new Map(order.map((id, index) => [id, index + 1]));
}

/**
 * Builds the pairing engine's input for the active players from the games
 * already played (including those of withdrawn players, who still count as
 * past opponents).
 */
export function candidatesFromHistory(
  players: { id: string; pairingNumber: number }[],
  games: PlayedGame[],
  byePoints: number,
): PairingCandidate[] {
  const scores = new Map(computeStandings(games, byePoints).map((row) => [row.playerId, row.score]));
  const chronological = [...games].sort((a, b) => a.round - b.round);

  return players.map(({ id, pairingNumber }) => {
    const opponents = new Set<string>();
    const colors: Color[] = [];
    let hadBye = false;

    for (const game of chronological) {
      if (game.whiteId === id && !game.blackId) hadBye = true;
      else if (game.whiteId === id && game.blackId) {
        opponents.add(game.blackId);
        colors.push("W");
      } else if (game.blackId === id && game.whiteId) {
        opponents.add(game.whiteId);
        colors.push("B");
      }
    }

    return { id, pairingNumber, score: scores.get(id) ?? 0, opponents, colors, hadBye };
  });
}
