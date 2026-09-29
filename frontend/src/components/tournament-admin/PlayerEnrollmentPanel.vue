<script setup lang="ts">
import { useQuery, useQueryCache } from "@pinia/colada";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import { useConfirm } from "../../lib/confirm";
import { extractErrorMessage } from "../../lib/errors";
import type { PlayerSearchResult } from "../../services/players";
import {
  addEnrolledPlayer,
  enrolledPlayersQuery,
  removeEnrolledPlayer,
  tournamentQuery,
} from "../../queries/tournaments";
import { enrollPlayer, withdrawPlayer, type EnrolledPlayer } from "../../services/tournaments";
import DataTable from "../ui/DataTable.vue";
import FadeSlide from "../ui/FadeSlide.vue";
import FormBanner from "../ui/FormBanner.vue";
import PlayerSearchPicker from "../ui/PlayerSearchPicker.vue";
import { dataTableColumns } from "../ui/dataTableFeatures";

const props = defineProps<{ tournamentId: string }>();

const cache = useQueryCache();
const tournament = useQuery(() => tournamentQuery(props.tournamentId));
const roster = useQuery(() => enrolledPlayersQuery(props.tournamentId));
const enrolledPlayers = computed(() => roster.data.value ?? []);
const confirm = useConfirm();
const { t } = useI18n();

// --- HU07: enroll player ---

const submitting = ref(false);
const error = ref<string | null>(null);

const registrationOpen = computed(() => tournament.data.value?.status === "REGISTRATION_OPEN");
const enrolledIds = computed(() => new Set(enrolledPlayers.value.map((p) => p.playerId)));

/** Enrolls a chosen player from the search results into the tournament; answers whether it worked. */
async function onEnroll(player: PlayerSearchResult): Promise<boolean> {
  error.value = null;
  submitting.value = true;
  try {
    addEnrolledPlayer(cache, props.tournamentId, await enrollPlayer(props.tournamentId, player.id));
    return true;
  } catch (submitError) {
    error.value = extractErrorMessage(submitError, t("common.genericServerError"));
    return false;
  } finally {
    submitting.value = false;
  }
}

// --- HU27: withdraw player ---

const withdrawing = ref<string | null>(null);

/** Withdraws an enrolled player from the tournament, after confirmation. */
async function onWithdraw(player: { playerId: string; name: string }): Promise<void> {
  const confirmed = await confirm({
    title: t("tournamentAdmin.withdraw"),
    message: t("tournamentAdmin.withdrawConfirm", { name: player.name }),
    confirmLabel: t("tournamentAdmin.withdraw"),
    danger: true,
  });
  if (!confirmed) {
    return;
  }

  error.value = null;
  withdrawing.value = player.playerId;
  try {
    await withdrawPlayer(props.tournamentId, player.playerId);
    removeEnrolledPlayer(cache, props.tournamentId, player.playerId);
  } catch (submitError) {
    error.value = extractErrorMessage(submitError, t("common.genericServerError"));
  } finally {
    withdrawing.value = null;
  }
}

const columnHelper = dataTableColumns<EnrolledPlayer>();

const columns = [
  columnHelper.accessor("name", { header: () => t("tournamentAdmin.tableName") }),
  columnHelper.accessor("universityCode", { header: () => t("tournamentAdmin.tableCode") }),
  columnHelper.accessor("program", { header: () => t("tournamentAdmin.tableProgram") }),
  columnHelper.accessor("semester", { header: () => t("tournamentAdmin.tableSemester") }),
  // Rendered by the template (#cell-actions).
  columnHelper.display({ id: "actions", header: "", enableSorting: false }),
];
</script>

<template>
  <section class="card">
    <h2 class="mb-1 text-lg">{{ t("tournamentAdmin.playersTitle") }}</h2>
    <p class="mb-4 text-sm">{{ t("tournamentAdmin.playersSubtitle") }}</p>

    <FadeSlide>
      <FormBanner v-if="error" kind="error" class="mb-4">{{ error }}</FormBanner>
    </FadeSlide>

    <PlayerSearchPicker
      id="playerQuery"
      :label="t('tournamentAdmin.searchLabel')"
      :placeholder="t('tournamentAdmin.searchPlaceholder')"
      :action-label="t('tournamentAdmin.enroll')"
      :added-label="t('tournamentAdmin.alreadyEnrolled')"
      :is-added="(player) => enrolledIds.has(player.id)"
      :busy="submitting"
      :pick="onEnroll"
      :disabled="!registrationOpen"
    />
    <p v-if="!registrationOpen" class="mb-4 text-sm text-text-muted">
      {{ t("tournamentAdmin.registrationClosedHint") }}
    </p>

    <DataTable
      class="mt-4"
      :columns="columns"
      :data="enrolledPlayers"
      :search-placeholder="t('tournamentAdmin.tableSearchPlaceholder')"
      :empty-message="t('tournamentAdmin.noPlayers')"
      sync-url
    >
      <template #cell-actions="{ row }">
        <button type="button" class="btn btn-ghost" :disabled="withdrawing === row.playerId" @click="onWithdraw(row)">
          {{ t("tournamentAdmin.withdraw") }}
        </button>
      </template>
    </DataTable>
  </section>
</template>
