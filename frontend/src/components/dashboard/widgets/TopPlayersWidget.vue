<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { formatNumber } from "../../../lib/format";
import { useWidgetData } from "../../../lib/useWidgetData";
import type { TopPlayer } from "../../../services/dashboard";
import { useLocaleStore } from "../../../stores/locale";
import PlayerName from "../PlayerName.vue";
import WidgetCard from "../WidgetCard.vue";

const { t } = useI18n();
const locale = useLocaleStore();
const { data, loading, error, reload } = useWidgetData<TopPlayer[]>("TOP_PLAYERS");

const maxPoints = computed(() => Math.max(1, ...(data.value ?? []).map((player) => player.points)));
</script>

<template>
  <WidgetCard
    widget="TOP_PLAYERS"
    :loading="loading"
    :error="error"
    :empty="!data || data.length === 0"
    :empty-message="t('widgets.TOP_PLAYERS.empty')"
    @retry="reload"
  >
    <ol class="m-0 flex list-none flex-col gap-3 p-0">
      <li v-for="(player, index) in data" :key="player.playerId" class="grid grid-cols-[2rem_1fr] items-start gap-3">
        <span
          class="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums"
          :class="index === 0 ? 'bg-accent text-[#17130a]' : 'bg-surface-2 text-text-muted'"
        >
          {{ index + 1 }}
        </span>
        <div class="flex min-w-0 flex-col gap-1">
          <div class="flex items-baseline justify-between gap-2 text-sm">
            <PlayerName :player-id="player.playerId" :name="player.name" />
            <span class="shrink-0 font-semibold text-text tabular-nums">
              {{ t("widgets.TOP_PLAYERS.points", { points: formatNumber(player.points, locale.locale) }) }}
            </span>
          </div>
          <!-- Points relative to the leader: one series, one color. -->
          <div class="h-1.5 rounded-r-[4px] bg-chart-1" :style="{ width: `${(player.points / maxPoints) * 100}%` }" />
          <p class="text-xs text-text-faint">
            {{
              t("widgets.TOP_PLAYERS.detail", {
                titles: player.titles,
                podiums: player.podiums,
                tournaments: player.tournaments,
              })
            }}
          </p>
        </div>
      </li>
    </ol>
  </WidgetCard>
</template>
