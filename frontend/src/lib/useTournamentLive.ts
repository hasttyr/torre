import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import type { Socket } from "socket.io-client";

import { getSocket, joinTournamentRoom, leaveTournamentRoom, SOCKET_EVENTS } from "../services/socket";

// A result triggers two events back to back (match.result.recorded +
// standings.updated); they're coalesced into a single refresh.
const COALESCE_MS = 150;

/**
 * HU09/HU14/HU18: keeps a view in sync with a tournament in real time.
 * Joins the tournament's Socket.IO room while the component is mounted and
 * calls `onChange` whenever pairings, results or standings change there.
 * The socket client loads on mount, in parallel with the view's data.
 *
 * @returns `connected`, for a "live" indicator.
 */
export function useTournamentLive(tournamentId: string, onChange: () => void): { connected: Ref<boolean> } {
  const connected = ref(false);
  let socket: Socket | undefined;
  let unmounted = false;
  let pending: ReturnType<typeof setTimeout> | undefined;

  const notify = (): void => {
    clearTimeout(pending);
    pending = setTimeout(onChange, COALESCE_MS);
  };
  // Re-joining on every (re)connection: Socket.IO drops room membership
  // when the connection drops.
  const onConnect = (): void => {
    connected.value = true;
    if (socket) joinTournamentRoom(socket, tournamentId);
  };
  const onDisconnect = (): void => {
    connected.value = false;
  };
  const events = Object.values(SOCKET_EVENTS);

  onMounted(async () => {
    const client = await getSocket();
    // The user may have left while the client was loading.
    if (unmounted) return;
    socket = client;
    client.on("connect", onConnect);
    client.on("disconnect", onDisconnect);
    events.forEach((event) => client.on(event, notify));
    if (client.connected) onConnect();
    else client.connect();
  });

  onBeforeUnmount(() => {
    unmounted = true;
    clearTimeout(pending);
    if (!socket) return;
    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
    events.forEach((event) => socket?.off(event, notify));
    leaveTournamentRoom(socket, tournamentId);
  });

  return { connected };
}
