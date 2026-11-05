<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import type { Round } from "../../services/rounds";

// "Your board": the game of whoever is looking, in the round in play, above
// the room. A player finds their table, color and opponent at a glance,
// without scanning every board. Only what the room already shows them.
const props = defineProps<{ round: Round; playerId: string | null }>();

const { t } = useI18n();

const mine = computed(() => {
  if (!props.playerId) return null;
  const match = props.round.matches.find(
    (candidate) => candidate.white?.playerId === props.playerId || candidate.black?.playerId === props.playerId,
  );
  if (!match) return null;
  const white = match.white?.playerId === props.playerId;
  return { match, white, opponent: white ? match.black : match.white };
});
const title = computed(() => t("myBoard.title", { number: props.round.number }));
</script>

<template>
  <section v-if="mine" class="card flex flex-col gap-1 border-accent/40" :aria-label="title" data-test="my-board">
    <p class="text-sm font-semibold text-accent">{{ title }}</p>
    <p v-if="mine.match.isBye" class="text-lg text-text">{{ t("myBoard.bye") }}</p>
    <p v-else class="text-lg text-text">
      {{
        t("myBoard.game", {
          board: mine.match.board,
          color: mine.white ? t("myBoard.white") : t("myBoard.black"),
          opponent: mine.opponent?.name ?? "",
        })
      }}
    </p>
  </section>
</template>
