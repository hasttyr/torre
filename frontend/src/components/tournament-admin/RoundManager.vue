<script setup lang="ts">
import { useQuery, useQueryCache } from "@pinia/colada";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import { useConfirm } from "../../lib/confirm";
import { extractErrorMessage } from "../../lib/errors";
import { useTournamentLive } from "../../lib/useTournamentLive";
import { useQueryStatus } from "../../queries/status";
import { invalidateTournament, roundsQuery, standingsQuery, tournamentQuery } from "../../queries/tournaments";
import { discardRound, generateRound, publishRound, swapPlayers, type SwapPayload } from "../../services/rounds";
import { finishTournament } from "../../services/tournaments";
import PairingsTable from "../tournament/PairingsTable.vue";
import LoadError from "../ui/LoadError.vue";
import SwapPlayersForm from "./SwapPlayersForm.vue";
import FormBanner from "../ui/FormBanner.vue";

// The organizer's control of the round cycle: generate the next round
// (HU08), review and adjust the draft (HU29), publish it (HU09) and, once
// every round is recorded, finish the tournament (HU17). Recording results
// happens in the tournament room, shared with arbiters. Which step is
// available is only a hint here: the backend enforces every rule.
const props = defineProps<{ tournamentId: string }>();

const cache = useQueryCache();
const confirm = useConfirm();
const { t } = useI18n();

const busy = ref(false);
const error = ref<string | null>(null);

// The same entries the admin page and the room read: one request each.
const tournamentEntry = useQuery(() => tournamentQuery(props.tournamentId));
const roundsEntry = useQuery(() => roundsQuery(props.tournamentId));
const standingsEntry = useQuery(() => standingsQuery(props.tournamentId));
const { loadError, retry } = useQueryStatus([roundsEntry, standingsEntry], "roundManager.loadError");

const tournament = computed(() => tournamentEntry.data.value ?? null);
const standings = computed(() => standingsEntry.data.value ?? null);
/** The round still in draft (at most one), if any. */
const draft = computed(() => roundsEntry.data.value?.find((round) => round.status === "GENERATED") ?? null);
const latest = computed(() => roundsEntry.data.value?.at(-1) ?? null);
const pendingResults = computed(() =>
  latest.value?.status === "RECORDING_RESULTS" ? latest.value.matches.filter((match) => !match.result).length : 0,
);
const nextNumber = computed(() => (latest.value?.number ?? 0) + 1);
const allPlayed = computed(
  () => latest.value?.status === "STANDINGS_UPDATED" && latest.value.number >= (tournament.value?.roundsCount ?? 0),
);
const canGenerate = computed(
  () =>
    !draft.value &&
    pendingResults.value === 0 &&
    !allPlayed.value &&
    (tournament.value?.status === "REGISTRATION_CLOSED" || tournament.value?.status === "IN_PROGRESS"),
);

// Arbiters record results from the room: live updates keep the pending count
// and the "generate next round" step current without a reload. A refresh
// that fails leaves the last data up; the next event tries again.
useTournamentLive(props.tournamentId, () => {
  invalidateTournament(cache, props.tournamentId).catch(() => undefined);
});

/**
 * Runs a round action, then re-reads everything about the tournament: the
 * server recalculates rounds and standings, and publishing round 1 or
 * finishing changes the tournament's status.
 *
 * @returns Whether the action went through; if not, the error is on screen.
 */
async function run(action: () => Promise<unknown>): Promise<boolean> {
  error.value = null;
  busy.value = true;
  try {
    await action();
    await invalidateTournament(cache, props.tournamentId);
    return true;
  } catch (err) {
    error.value = extractErrorMessage(err, t("common.genericServerError"));
    return false;
  } finally {
    busy.value = false;
  }
}

const onGenerate = () => run(() => generateRound(props.tournamentId));

/** Swaps two seats in the draft (the form is only shown while there's one). */
async function onSwap(payload: SwapPayload): Promise<boolean> {
  const round = draft.value;
  return round ? run(() => swapPlayers(round.id, payload)) : false;
}

async function onPublish(): Promise<void> {
  const round = draft.value;
  if (!round) return;
  const confirmed = await confirm({
    title: t("roundManager.publishTitle", { number: round.number }),
    message: t("roundManager.publishMessage"),
    confirmLabel: t("roundManager.publish"),
  });
  if (confirmed) await run(() => publishRound(round.id));
}

async function onDiscard(): Promise<void> {
  const round = draft.value;
  if (!round) return;
  const confirmed = await confirm({
    title: t("roundManager.discardTitle", { number: round.number }),
    message: t("roundManager.discardMessage"),
    confirmLabel: t("roundManager.discard"),
    danger: true,
  });
  if (confirmed) await run(() => discardRound(round.id));
}

async function onFinish(): Promise<void> {
  const confirmed = await confirm({
    title: t("roundManager.finishTitle"),
    message: t("roundManager.finishMessage"),
    confirmLabel: t("roundManager.finish"),
    danger: true,
  });
  if (confirmed) await run(() => finishTournament(props.tournamentId));
}
</script>

<template>
  <section class="card flex flex-col gap-4" data-test="round-manager">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-lg">{{ t("roundManager.title") }}</h2>
        <p class="mt-0.5 text-sm">
          {{
            t("roundManager.progress", {
              played: standings?.roundsCompleted ?? 0,
              total: tournament?.roundsCount ?? "—",
            })
          }}
        </p>
      </div>
      <RouterLink :to="`/torneos/${tournamentId}/sala`" class="btn btn-ghost px-4 py-2 text-sm">
        {{ t("roundManager.openRoom") }}
      </RouterLink>
    </header>

    <LoadError v-if="loadError" :message="loadError" :retry="retry" />
    <FormBanner v-if="error" kind="error">{{ error }}</FormBanner>

    <!-- Draft: review, adjust, publish or discard (HU09, HU29). -->
    <template v-if="draft">
      <p class="banner border-accent/35 bg-accent/10 text-text">
        {{ t("roundManager.draftBanner", { number: draft.number }) }}
      </p>
      <PairingsTable :round="draft" />
      <SwapPlayersForm :round="draft" :busy="busy" :submit="onSwap" />
      <div class="flex flex-wrap gap-3">
        <button type="button" class="btn btn-primary" :disabled="busy" @click="onPublish">
          {{ t("roundManager.publishRound", { number: draft.number }) }}
        </button>
        <button type="button" class="btn btn-ghost" :disabled="busy" @click="onDiscard">
          {{ t("roundManager.discard") }}
        </button>
      </div>
    </template>

    <!-- A published round still being played. -->
    <p v-else-if="pendingResults > 0" class="banner border-border bg-surface-2 text-text-muted">
      {{ t("roundManager.inPlay", { number: latest?.number, count: pendingResults }, pendingResults) }}
    </p>

    <template v-else-if="tournament?.status === 'FINISHED'">
      <FormBanner kind="success">{{ t("roundManager.finished") }}</FormBanner>
    </template>

    <template v-else-if="allPlayed">
      <p class="text-sm">{{ t("roundManager.allPlayed") }}</p>
      <button type="button" class="btn btn-primary self-start" :disabled="busy" @click="onFinish">
        {{ t("roundManager.finish") }}
      </button>
    </template>

    <template v-else-if="canGenerate">
      <p class="text-sm">{{ t("roundManager.generateHint") }}</p>
      <button type="button" class="btn btn-primary self-start" :disabled="busy" @click="onGenerate">
        {{ busy ? t("roundManager.generating") : t("roundManager.generate", { number: nextNumber }) }}
      </button>
    </template>

    <p v-else class="text-sm text-text-muted">{{ t("roundManager.closeRegistrationFirst") }}</p>
  </section>
</template>
