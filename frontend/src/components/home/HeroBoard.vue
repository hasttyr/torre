<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { formatNumber, formatResult } from "../../lib/format";
import { fenSquares, type PieceLetter } from "./fen";
import LiveBadge from "./LiveBadge.vue";
import { SAMPLE_PAIRINGS, SAMPLE_POSITION, SAMPLE_STANDINGS } from "./sampleTournament";

// The landing's centerpiece: a board seen from across the table, tilted
// back with its pieces standing up, and two cards floating beside it with
// what the app shows about that game (the round live, the leader). The
// cards only fit beside the board from md upward; below that, the live
// card sits on the board's corner and the leader's card is left out.
const { t, locale } = useI18n();

// Filled glyphs for both sides, colored per side. U+FE0E keeps the pawn a
// text glyph where a platform would draw it as an emoji.
const GLYPHS: Record<PieceLetter, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟︎" };

const squares = fenSquares(SAMPLE_POSITION);
// Black's last move, 3…a6: a7 and a6.
const LAST_MOVE = new Set([8, 16]);
const isLight = (index: number) => (Math.floor(index / 8) + (index % 8)) % 2 === 0;

function squareColor(index: number): string {
  if (LAST_MOVE.has(index)) return isLight(index) ? "bg-[#ead48c]" : "bg-[#caa54b]";
  return isLight(index) ? "bg-[#efe4c8]" : "bg-[#b8893f]";
}

const game = SAMPLE_PAIRINGS[0];
const leader = SAMPLE_STANDINGS[0];
</script>

<template>
  <div data-render aria-hidden="true" class="relative mx-auto w-full max-w-[30rem] select-none lg:max-w-[34rem]">
    <div class="@container animate-rise-in motion-reduce:animate-none">
      <div class="perspective-[1400px]">
        <div class="rotate-x-[22deg] rounded-[3%] bg-[#2a2217] p-[3%] shadow-product transform-3d">
          <div class="grid grid-cols-8 transform-3d">
            <div
              v-for="(square, index) in squares"
              :key="index"
              class="relative aspect-square transform-3d"
              :class="squareColor(index)"
            >
              <span
                v-if="square"
                class="absolute inset-0 flex origin-bottom -rotate-x-[22deg] items-end justify-center pb-[6%] font-['Segoe_UI_Symbol','Apple_Symbols','Noto_Sans_Symbols_2',serif] text-[9cqw] leading-none"
                :class="
                  square.side === 'white'
                    ? 'text-[#fbf8f0] [text-shadow:0_0_1px_#2a2217,0_0_1px_#2a2217,0_2px_3px_rgb(0_0_0/30%)]'
                    : 'text-[#1b1914] [text-shadow:0_2px_3px_rgb(0_0_0/25%)]'
                "
              >
                {{ GLYPHS[square.piece] }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      class="absolute top-3 left-3 flex animate-rise-in flex-col gap-2 rounded-2xl border border-border-soft bg-surface/90 px-3.5 py-3 text-left text-text shadow-product backdrop-blur-md [animation-delay:350ms] motion-reduce:animate-none md:top-[10%] md:-left-20 md:px-4"
    >
      <span class="flex items-center gap-2">
        <LiveBadge :label="t('home.mock.live')" />
        <span class="text-xs text-text-muted">{{ t("home.mock.round") }}</span>
      </span>
      <span class="flex items-center gap-2.5 text-sm whitespace-nowrap">
        <span class="font-semibold">{{ game.white }}</span>
        <span class="font-display tabular-nums">{{ formatResult(game.result) }}</span>
        <span class="text-text-muted">{{ game.black }}</span>
      </span>
    </div>

    <div
      class="absolute -right-20 bottom-[16%] hidden animate-rise-in flex-col rounded-2xl border border-border-soft bg-surface/90 px-4 py-3 text-left text-text shadow-product backdrop-blur-md [animation-delay:550ms] motion-reduce:animate-none md:flex"
    >
      <span class="text-xs text-text-muted">{{ t("home.mock.leader") }}</span>
      <span class="text-sm font-semibold">{{ leader.name }}</span>
      <span class="mt-1 flex items-baseline gap-2">
        <span class="font-display text-2xl leading-none tabular-nums">{{ formatNumber(leader.points, locale) }}</span>
        <span class="text-xs text-text-muted"
          >{{ t("home.mock.points") }}, Bh {{ formatNumber(leader.buchholz, locale) }}</span
        >
      </span>
    </div>
  </div>
</template>
