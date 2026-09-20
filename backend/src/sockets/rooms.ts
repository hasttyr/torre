/**
 * Names the Socket.IO room for a tournament's real-time channel.
 *
 * @remarks
 * Every pairing/result/standings event is scoped to one tournament — a
 * client watching tournament A must never receive tournament B's traffic.
 * Centralized here so the join/leave handlers and every future emitter
 * (HU08-HU14) spell the room name identically.
 */
export function tournamentRoom(tournamentId: string): string {
  return `tournament:${tournamentId}`;
}
