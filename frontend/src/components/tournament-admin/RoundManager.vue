<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import { useConfirm } from "../../lib/confirm";
import { extractErrorMessage } from "../../lib/errors";
import type { SwapPayload } from "../../services/rounds";
import { useRoundsStore } from "../../stores/rounds";
import { useTournamentsStore } from "../../stores/tournaments";
import PairingsTable from "../tournament/PairingsTable.vue";
import LoadError from "../ui/LoadError.vue";
import SwapPlayersForm from "./SwapPlayersForm.vue";

// The organizer's control of the round cycle: generate the next round
// (HU08), review and adjust the draft (HU29), publish it (HU09) and, once
// every round is recorded, finish the tournament (HU17). Recording results
// happens in the tournament room, shared with arbiters. Which step is
// available is only a hint here: the backend enforces every rule.
const props = defineProps<{ tournamentId: string }>();

const tournaments = useTournamentsStore();
const rounds = useRoundsStore();
const confirm = useConfirm();
const { t } = useI18n();

const busy = ref(false);
const error = ref<string | null>(null);
const loadError = ref<string | null>(null);

const tournament = computed(() => tournaments.current);
const latest = computed(() => rounds.rounds.at(-1) ?? null);
const pendingResults = computed(() =>
  latest.value?.status === "RECORDING_RESULTS" ? latest.value.matches.filter((match) => !match.result).length : 0,
);
const nextNumber = computed(() => (latest.value?.number ?? 0) + 1);
const allPlayed = computed(
  () => latest.value?.status === "STANDINGS_UPDATED" && latest.value.number >= (tournament.value?.roundsCount ?? 0),
);
const canGenerate = computed(
  () =>
    !rounds.draft &&
    pendingResults.value === 0 &&
    !allPlayed.value &&
    (tournament.value?.status === "REGISTRATION_CLOSED" || tournament.value?.status === "IN_PROGRESS"),
);

onMounted(async () => {
  try {
    await rounds.load(props.tournamentId);
  } catch (err) {
    loadError.value = extractErrorMessage(err, t("roundManager.loadError"));
  }
});

/** Runs a round action, then re-reads the tournament (publishing round 1 or finishing changes its status). */
async function run(action: () => Promise<void>): Promise<void> {
  error.value = null;
  busy.value = true;
  try {
    await action();
    await tournaments.refreshCurrent(props.tournamentId);
  } catch (err) {
    error.value = extractErrorMessage(err, t("tournamentAdmin.genericServerError"));
  } finally {
    busy.value = false;
  }
}

const onGenerate = () => run(() => rounds.generate());
const onSwap = (payload: SwapPayload) => run(() => rounds.swap(rounds.draft!.id, payload));

async function onPublish(): Promise<void> {
  const draft = rounds.draft!;
  const confirmed = await confirm({
    title: t("roundManager.publishTitle", { number: draft.number }),
    message: t("roundManager.publishMessage"),
    confirmLabel: t("roundManager.publish"),
  });
  if (confirmed) await run(() => rounds.publish(draft.id));
}

async function onDiscard(): Promise<void> {
  const draft = rounds.draft!;
  const confirmed = await confirm({
    title: t("roundManager.discardTitle", { number: draft.number }),
    message: t("roundManager.discardMessage"),
    confirmLabel: t("roundManager.discard"),
    danger: true,
  });
  if (confirmed) await run(() => rounds.discard(draft.id));
}

async function onFinish(): Promise<void> {
  const confirmed = await confirm({
    title: t("roundManager.finishTitle"),
    message: t("roundManager.finishMessage"),
    confirmLabel: t("roundManager.finish"),
    danger: true,
  });
  if (confirmed) await run(() => tournaments.finish(props.tournamentId));
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
              played: rounds.standings?.roundsCompleted ?? 0,
              total: tournament?.roundsCount ?? "—",
            })
          }}
        </p>
      </div>
      <RouterLink :to="`/torneos/${tournamentId}/sala`" class="btn btn-ghost px-4 py-2 text-sm">
        {{ t("roundManager.openRoom") }}
      </RouterLink>
    </header>

    <LoadError v-if="loadError" :message="loadError" />
    <p v-if="error" role="alert" class="banner banner--error">{{ error }}</p>

    <!-- Draft: review, adjust, publish or discard (HU09, HU29). -->
    <template v-if="rounds.draft">
      <p class="banner border-accent/35 bg-accent/10 text-text">
        {{ t("roundManager.draftBanner", { number: rounds.draft.number }) }}
      </p>
      <PairingsTable :round="rounds.draft" />
      <SwapPlayersForm :round="rounds.draft" :busy="busy" @swap="onSwap" />
      <div class="flex flex-wrap gap-3">
        <button type="button" class="btn btn-primary" :disabled="busy" @click="onPublish">
          {{ t("roundManager.publishRound", { number: rounds.draft.number }) }}
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
      <p role="status" class="banner banner--success">{{ t("roundManager.finished") }}</p>
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
