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

const points = (player: TopPlayer) =>
  t("widgets.TOP_PLAYERS.points", { points: formatNumber(player.points, locale.locale) });
const detail = (player: TopPlayer) =>
  t("widgets.TOP_PLAYERS.detail", { titles: player.titles, podiums: player.podiums, tournaments: player.tournaments });

// The first three stand on a podium, the leader in the middle and highest;
// on it, gold deepens with the place. Everyone else follows in a list whose
// bars measure points against the best score.
const PODIUM = [
  { place: 1, order: "order-2", height: "h-24 sm:h-28", tone: 1 },
  { place: 2, order: "order-1", height: "h-16 sm:h-20", tone: 0.55 },
  { place: 3, order: "order-3", height: "h-11 sm:h-14", tone: 0.35 },
];

const podium = computed(() =>
  PODIUM.flatMap((step) => {
    const player = data.value?.[step.place - 1];
    return player ? [{ ...step, player }] : [];
  }),
);
const rest = computed(() => (data.value ?? []).slice(3));
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
    <div class="flex flex-col gap-6">
      <ol class="m-0 grid list-none grid-cols-3 items-end gap-2 p-0 sm:gap-3">
        <li v-for="step in podium" :key="step.place" class="flex min-w-0 flex-col items-center" :class="step.order">
          <span
            class="mb-2 inline-flex size-9 items-center justify-center rounded-full font-display text-base font-semibold tabular-nums"
            :class="step.place === 1 ? 'bg-accent text-on-accent' : 'bg-text/8 text-text'"
          >
            {{ step.place }}
          </span>
          <span class="w-full truncate text-center text-[0.95rem] [&>*]:max-w-full [&>*]:truncate">
            <PlayerName :player-id="step.player.playerId" :name="step.player.name" />
          </span>
          <span
            class="mt-1 font-display text-[1.375rem] leading-tight font-semibold tracking-[-0.03em] text-text tabular-nums"
          >
            {{ points(step.player) }}
          </span>
          <span class="mb-3 hidden text-center text-xs text-text-faint sm:block">{{ detail(step.player) }}</span>
          <span
            class="w-full rounded-t-2xl bg-chart-1"
            :class="step.height"
            :style="{ opacity: step.tone }"
            aria-hidden="true"
          />
        </li>
      </ol>

      <ol v-if="rest.length > 0" class="m-0 flex list-none flex-col gap-1 p-0" start="4">
        <li
          v-for="(player, index) in rest"
          :key="player.playerId"
          class="grid grid-cols-[1.75rem_1fr_auto] items-center gap-x-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-text/4"
        >
          <span class="text-center text-sm font-semibold text-text-faint tabular-nums">{{ index + 4 }}</span>
          <span class="flex min-w-0 flex-col gap-1.5">
            <span class="flex min-w-0 flex-col text-[0.95rem] sm:flex-row sm:items-baseline sm:gap-2">
              <PlayerName :player-id="player.playerId" :name="player.name" />
              <span class="truncate text-xs text-text-faint">{{ detail(player) }}</span>
            </span>
            <span class="h-1 overflow-hidden rounded-full bg-text/6" aria-hidden="true">
              <span
                class="block h-full rounded-full bg-chart-1"
                :style="{ width: `${(player.points / maxPoints) * 100}%` }"
              />
            </span>
          </span>
          <span class="font-semibold text-text tabular-nums">{{ points(player) }}</span>
        </li>
      </ol>
    </div>
  </WidgetCard>
</template>
