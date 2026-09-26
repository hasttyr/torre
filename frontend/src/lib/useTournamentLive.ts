import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";

import { joinTournamentRoom, leaveTournamentRoom, socket, SOCKET_EVENTS } from "../services/socket";

// A result triggers two events back to back (match.result.recorded +
// standings.updated); they're coalesced into a single refresh.
const COALESCE_MS = 150;

/**
 * HU09/HU14/HU18: keeps a view in sync with a tournament in real time.
 * Joins the tournament's Socket.IO room while the component is mounted and
 * calls `onChange` whenever pairings, results or standings change there.
 *
 * @returns `connected`, for a "live" indicator.
 */
export function useTournamentLive(tournamentId: string, onChange: () => void): { connected: Ref<boolean> } {
  const connected = ref(socket.connected);
  let pending: ReturnType<typeof setTimeout> | undefined;

  const notify = (): void => {
    clearTimeout(pending);
    pending = setTimeout(onChange, COALESCE_MS);
  };
  // Re-joining on every (re)connection: Socket.IO drops room membership
  // when the connection drops.
  const onConnect = (): void => {
    connected.value = true;
    joinTournamentRoom(tournamentId);
  };
  const onDisconnect = (): void => {
    connected.value = false;
  };
  const events = Object.values(SOCKET_EVENTS);

  onMounted(() => {
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    events.forEach((event) => socket.on(event, notify));
    if (socket.connected) onConnect();
    else socket.connect();
  });

  onBeforeUnmount(() => {
    clearTimeout(pending);
    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
    events.forEach((event) => socket.off(event, notify));
    leaveTournamentRoom(tournamentId);
  });

  return { connected };
}
