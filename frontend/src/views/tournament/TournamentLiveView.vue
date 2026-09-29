<script setup lang="ts">
import { useQuery, useQueryCache } from "@pinia/colada";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "reka-ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

import AppHeader from "../../components/layout/AppHeader.vue";
import LoadError from "../../components/ui/LoadError.vue";
import PairingsTable from "../../components/tournament/PairingsTable.vue";
import ResultEntry from "../../components/tournament/ResultEntry.vue";
import StandingsTable from "../../components/tournament/StandingsTable.vue";
import TournamentStats from "../../components/tournament/TournamentStats.vue";
import { saveFile } from "../../lib/download";
import { extractErrorMessage } from "../../lib/errors";
import { canExportDocuments, canManageTournament, canRecordResults } from "../../lib/tournamentAccess";
import { useQueryParam } from "../../lib/useQueryParam";
import { useTournamentLive } from "../../lib/useTournamentLive";
import { useQueryStatus } from "../../queries/status";
import {
  invalidateTournament,
  roundsQuery,
  standingsQuery,
  statsQuery,
  tournamentQuery,
} from "../../queries/tournaments";
import {
  correctResult,
  downloadPairingsPdf,
  downloadStandingsPdf,
  recordResult,
  type GameResult,
} from "../../services/rounds";
import { useAuthStore } from "../../stores/auth";
import FormBanner from "../../components/ui/FormBanner.vue";

// HU18: the tournament room. Everyone sees the published pairings, results
// and standings, updated live (HU09/HU14); arbiters and the tournament's
// organizer also record and correct results here, board by board (HU10/HU11).
const route = useRoute();
const tournamentId = String(route.params.id);
const auth = useAuthStore();
const cache = useQueryCache();
const { t } = useI18n();

// Usually already on their way: the route prefetches them (router/index.ts).
const tournamentEntry = useQuery(tournamentQuery(tournamentId));
const roundsEntry = useQuery(roundsQuery(tournamentId));
const standingsEntry = useQuery(standingsQuery(tournamentId));
const statsEntry = useQuery(statsQuery(tournamentId));
const { loading, loadError, retry } = useQueryStatus(
  [tournamentEntry, roundsEntry, standingsEntry, statsEntry],
  "tournamentRoom.loadError",
);
const standings = computed(() => standingsEntry.data.value ?? null);
const stats = computed(() => statsEntry.data.value ?? null);

const actionError = ref<string | null>(null);
const busyMatch = ref<string | null>(null);

// Only published rounds belong in the room, even for its managers: drafts
// are reviewed in the admin panel.
const published = computed(() => (roundsEntry.data.value ?? []).filter((round) => round.status !== "GENERATED"));

// An older round picked on purpose lives in the URL (?ronda=2), so a link
// opens it. Without the param the room shows the newest round, and keeps
// following it as new ones get published.
const roundParam = useQueryParam("ronda");
const selectedRound = computed(
  () => published.value.find((round) => String(round.number) === roundParam.value) ?? published.value.at(-1) ?? null,
);

function selectRound(number: string | number): void {
  roundParam.value = Number(number) === published.value.at(-1)?.number ? "" : String(number);
}
const tournament = computed(() => tournamentEntry.data.value ?? null);
const canRecord = computed(() => (tournament.value ? canRecordResults(tournament.value, auth.user) : false));
const canManage = computed(() => (tournament.value ? canManageTournament(tournament.value, auth.user) : false));
const canExport = computed(() => (tournament.value ? canExportDocuments(tournament.value, auth.user) : false));
const exporting = ref(false);

// A result recorded here, or anywhere: the room reads everything again. A
// refresh that fails leaves the last data up; the next event tries again.
const refresh = () => invalidateTournament(cache, tournamentId).catch(() => undefined);
const { connected } = useTournamentLive(tournamentId, refresh);

async function withMatch(matchId: string, action: () => Promise<void>): Promise<void> {
  actionError.value = null;
  busyMatch.value = matchId;
  try {
    await action();
    await refresh();
  } catch (error) {
    actionError.value = extractErrorMessage(error, t("common.genericServerError"));
  } finally {
    busyMatch.value = null;
  }
}

/** HU30: downloads an official PDF (the server builds it from the current official data). */
async function exportPdf(download: () => Promise<Blob>, filename: string): Promise<void> {
  actionError.value = null;
  exporting.value = true;
  try {
    saveFile(await download(), filename);
  } catch (error) {
    actionError.value = extractErrorMessage(error, t("tournamentRoom.exportError"));
  } finally {
    exporting.value = false;
  }
}

const onExportStandings = () => exportPdf(() => downloadStandingsPdf(tournamentId), t("tournamentRoom.standingsFile"));
const onExportRound = (roundId: string, number: number) =>
  exportPdf(() => downloadPairingsPdf(roundId), t("tournamentRoom.roundFile", { number }));

const onRecord = (matchId: string, value: GameResult) => withMatch(matchId, () => recordResult(matchId, value));
const onCorrect = (matchId: string, value: GameResult, reason: string) =>
  withMatch(matchId, () => correctResult(matchId, value, reason || undefined));
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container flex flex-col gap-6 py-10 sm:py-12">
      <p v-if="loading">{{ t("tournamentRoom.loading") }}</p>
      <LoadError v-else-if="loadError" :message="loadError" :retry="retry" />

      <template v-else-if="tournament">
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-accent uppercase">
              <span
                class="h-2 w-2 rounded-full"
                :class="connected ? 'animate-pulse bg-success' : 'bg-text-faint'"
                aria-hidden="true"
              />
              {{ connected ? t("tournamentRoom.live") : t("tournamentRoom.offline") }}
            </p>
            <h1 class="mt-1 text-2xl sm:text-3xl">{{ tournament.name }}</h1>
            <p class="mt-1 text-sm">
              {{ t(`estados.${tournament.status}`) }} ·
              {{
                t("tournamentRoom.roundsPlayed", {
                  played: standings?.roundsCompleted ?? 0,
                  total: tournament.roundsCount ?? "—",
                })
              }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <template v-if="canExport">
              <button
                type="button"
                class="btn btn-ghost px-4 py-2 text-sm"
                :disabled="exporting || !standings?.rows.length"
                @click="onExportStandings"
              >
                {{ t("tournamentRoom.exportStandings") }}
              </button>
              <button
                v-if="selectedRound"
                type="button"
                class="btn btn-ghost px-4 py-2 text-sm"
                :disabled="exporting"
                @click="onExportRound(selectedRound.id, selectedRound.number)"
              >
                {{ t("tournamentRoom.exportRound", { number: selectedRound.number }) }}
              </button>
            </template>
            <RouterLink v-if="canManage" :to="`/torneos/${tournamentId}`" class="btn btn-ghost px-4 py-2 text-sm">
              {{ t("tournamentRoom.manage") }}
            </RouterLink>
          </div>
        </header>

        <FormBanner v-if="actionError" kind="error">{{ actionError }}</FormBanner>

        <div class="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          <!-- reka-ui Tabs: arrow keys move between rounds, and screen readers
               read each round's boards as the panel of its tab. -->
          <TabsRoot
            as="section"
            class="card flex flex-col gap-4"
            :aria-label="t('tournamentRoom.pairings')"
            :model-value="selectedRound?.number"
            @update:model-value="selectRound"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="text-lg">{{ t("tournamentRoom.pairings") }}</h2>
              <TabsList
                v-if="published.length > 0"
                :aria-label="t('tournamentRoom.roundsLabel')"
                class="flex flex-wrap gap-1 rounded-xl border border-border-soft p-1"
              >
                <TabsTrigger
                  v-for="round in published"
                  :key="round.id"
                  :value="round.number"
                  class="min-w-9 rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums transition-colors"
                  :class="
                    round.number === selectedRound?.number
                      ? 'bg-accent text-on-accent'
                      : 'text-text-muted hover:bg-accent/10'
                  "
                >
                  {{ t("tournamentRoom.roundTab", { number: round.number }) }}
                </TabsTrigger>
              </TabsList>
            </div>

            <p v-if="!selectedRound" class="text-sm text-text-muted">{{ t("tournamentRoom.noRounds") }}</p>

            <TabsContent v-for="round in published" :key="round.id" :value="round.number">
              <PairingsTable :round="round">
                <template v-if="canRecord" #actions="{ match }">
                  <ResultEntry
                    :match="match"
                    :busy="busyMatch === match.id"
                    @record="onRecord(match.id, $event)"
                    @correct="(value, reason) => onCorrect(match.id, value, reason)"
                  />
                </template>
              </PairingsTable>
            </TabsContent>
          </TabsRoot>

          <div class="flex flex-col gap-5">
            <section class="card flex flex-col gap-4" :aria-label="t('tournamentRoom.standings')">
              <h2 class="text-lg">{{ t("tournamentRoom.standings") }}</h2>
              <StandingsTable v-if="standings" :standings="standings" />
            </section>

            <!-- HU16 -->
            <section v-if="stats" class="card flex flex-col gap-4" :aria-label="t('tournamentRoom.stats')">
              <h2 class="text-lg">{{ t("tournamentRoom.stats") }}</h2>
              <TournamentStats :stats="stats" />
            </section>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
