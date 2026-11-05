<script setup lang="ts">
import { useQuery } from "@pinia/colada";
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

import AppHeader from "../components/layout/AppHeader.vue";
import PairingsTable from "../components/tournament/PairingsTable.vue";
import StandingsTable from "../components/tournament/StandingsTable.vue";
import LoadError from "../components/ui/LoadError.vue";
import LoadingSkeleton from "../components/ui/LoadingSkeleton.vue";
import { publicRoomQuery } from "../queries/tournaments";
import { useQueryStatus } from "../queries/status";
import type { PublicRoom } from "../services/tournaments";

// #140: a tournament's room, read-only and without a session, to project it
// at the venue or share a link. The API sends names and sporting figures
// only; the page refreshes itself while the tournament is being played,
// since a visitor has no socket ticket for the live updates.
const REFRESH_MS = 60_000;

const route = useRoute();
const tournamentId = String(route.params.id);
const { t } = useI18n();

const query = useQuery(publicRoomQuery(tournamentId));
const { loading, loadError, retry } = useQueryStatus(query, "publicRoom.loadError");
const room = computed(() => query.data.value ?? null);

type PublicRound = PublicRoom["rounds"][number];

/** The public boards, as the shared pairings table reads them. */
const boardsOf = (round: PublicRound) => ({
  matches: round.matches.map((match) => ({
    ...match,
    white: match.white === null ? null : { name: match.white },
    black: match.black === null ? null : { name: match.black },
  })),
});

// Newest round first: it's the one the room is looking for.
const rounds = computed(() => [...(room.value?.rounds ?? [])].reverse());
const latest = computed(() => rounds.value[0] ?? null);
const earlier = computed(() => rounds.value.slice(1));

let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    if (room.value?.tournament.status === "IN_PROGRESS") void query.refetch();
  }, REFRESH_MS);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="container flex max-w-5xl flex-col gap-8 pt-12 pb-20 sm:pt-16 sm:pb-28">
      <LoadingSkeleton v-if="loading" :label="t('publicRoom.loading')" variant="list" />
      <LoadError v-else-if="loadError" :message="loadError" :retry="retry" />

      <template v-else-if="room">
        <div>
          <p class="text-sm text-text-muted">
            {{ t(room.tournament.status === "FINISHED" ? "publicRoom.finished" : "publicRoom.inProgress") }}
          </p>
          <h1 class="page-title">{{ room.tournament.name }}</h1>
          <p class="mt-3 text-sm text-text-muted">{{ t("publicRoom.notice") }}</p>
        </div>

        <div class="grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="public-round-heading" class="flex flex-col gap-3">
            <h2 id="public-round-heading" class="text-lg">
              {{ latest ? t("publicRoom.round", { number: latest.number }) : t("publicRoom.pairings") }}
            </h2>
            <p v-if="!latest" class="empty-state">{{ t("publicRoom.noRounds") }}</p>
            <PairingsTable v-else :round="boardsOf(latest)" />
          </section>

          <section aria-labelledby="public-standings-heading" class="flex flex-col gap-3">
            <h2 id="public-standings-heading" class="text-lg">{{ t("publicRoom.standings") }}</h2>
            <StandingsTable :standings="room.standings" />
          </section>
        </div>

        <section v-if="earlier.length > 0" aria-labelledby="public-earlier-heading" class="flex flex-col gap-3">
          <h2 id="public-earlier-heading" class="text-lg">{{ t("publicRoom.earlier") }}</h2>
          <details v-for="round in earlier" :key="round.number" class="rounded-2xl border border-border-soft p-3">
            <summary class="cursor-pointer font-semibold">
              {{ t("publicRoom.round", { number: round.number }) }}
            </summary>
            <div class="mt-3">
              <PairingsTable :round="boardsOf(round)" />
            </div>
          </details>
        </section>
      </template>
    </main>
  </div>
</template>
