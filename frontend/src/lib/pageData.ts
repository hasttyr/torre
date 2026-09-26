import { getDashboard } from "../services/dashboard";
import { useRoundsStore } from "../stores/rounds";
import { useTournamentsStore } from "../stores/tournaments";

// What each prefetching page loads before it can render. The route starts
// it in its beforeEnter guard (router/index.ts, through prefetchData) and
// the page takes it on mount (through takeData): both call these same
// functions, so what's prefetched is always exactly what the page needs.

/** The dashboard's widget list and selectable players (PanelView). */
export function loadDashboard() {
  return getDashboard();
}

/** A tournament room's rounds, standings, stats and header (TournamentLiveView). */
export async function loadTournamentRoom(tournamentId: string): Promise<void> {
  await Promise.all([useRoundsStore().load(tournamentId), useTournamentsStore().refreshCurrent(tournamentId)]);
}

/** A tournament's admin page: the tournament and its enrolled players (TournamentAdminView). */
export async function loadTournamentAdmin(tournamentId: string): Promise<void> {
  await useTournamentsStore().load(tournamentId);
}
