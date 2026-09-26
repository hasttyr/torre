<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { formatPercent } from "../../lib/format";
import type { TournamentStats } from "../../services/rounds";
import { useLocaleStore } from "../../stores/locale";
import ResultLegend from "../charts/ResultLegend.vue";
import ResultSplitBar from "../charts/ResultSplitBar.vue";
import StatTile from "../dashboard/StatTile.vue";

// HU16: the tournament at a glance — who's playing, how many games, how
// decisive they were and how each round split between white and black.
const props = defineProps<{ stats: TournamentStats }>();

const { t } = useI18n();
const locale = useLocaleStore();

const tiles = computed(() => [
  {
    key: "players",
    value: String(props.stats.activePlayers),
    hint:
      props.stats.withdrawnPlayers > 0
        ? t("tournamentStats.withdrawn", { count: props.stats.withdrawnPlayers }, props.stats.withdrawnPlayers)
        : undefined,
  },
  { key: "games", value: String(props.stats.gamesPlayed) },
  { key: "decisive", value: formatPercent(props.stats.decisiveRate, locale.locale) },
  { key: "whiteScore", value: formatPercent(props.stats.whiteScoreRate, locale.locale) },
]);

// ResultSplitBar speaks in wins/draws/losses; from the board's side those are
// white wins / draws / black wins.
const asTally = (results: { whiteWins: number; draws: number; blackWins: number }) => ({
  wins: results.whiteWins,
  draws: results.draws,
  losses: results.blackWins,
});
</script>

<template>
  <div class="flex flex-col gap-5">
    <dl class="m-0 grid grid-cols-2 gap-3">
      <StatTile
        v-for="tile in tiles"
        :key="tile.key"
        :label="t(`tournamentStats.${tile.key}`)"
        :value="tile.value"
        :hint="tile.hint"
      />
    </dl>

    <p v-if="stats.gamesPlayed === 0" class="text-sm text-text-muted">{{ t("tournamentStats.noGames") }}</p>

    <div v-else class="flex flex-col gap-3">
      <ResultLegend perspective="board" />
      <ResultSplitBar :tally="asTally(stats)" perspective="board" :label="t('tournamentStats.allRounds')" />
      <ResultSplitBar
        v-for="round in stats.rounds"
        :key="round.round"
        :tally="asTally(round)"
        perspective="board"
        compact
        :label="
          round.pending > 0
            ? t('tournamentStats.roundPending', { round: round.round, count: round.pending }, round.pending)
            : t('tournamentStats.round', { round: round.round })
        "
      />
    </div>
  </div>
</template>
