<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { formatNumber } from "../../lib/format";
import { SAMPLE_STANDINGS } from "./sampleTournament";

// The exported standings as printed sheets: paper stays paper-white in both
// themes, since it's an object on the tile, not part of the interface.
const { t, locale } = useI18n();
</script>

<template>
  <div class="relative mx-auto aspect-[4/5] w-[min(100%,16.5rem)]">
    <div class="absolute inset-0 rotate-[5deg] rounded-md bg-[#ece6d8] shadow-product" />
    <div
      class="absolute inset-0 flex -rotate-2 flex-col rounded-md bg-[#fffdf8] p-[9%] text-left text-[#211e18] shadow-product"
    >
      <span class="text-[0.6rem] text-[#8a8371]">Torre Central Hub</span>
      <span class="mt-1 font-display text-lg leading-tight font-semibold">{{ t("home.mock.pdfTitle") }}</span>
      <ol class="mt-4 flex flex-col gap-2.5 text-[0.7rem]">
        <li v-for="(row, index) in SAMPLE_STANDINGS" :key="row.name" class="flex items-baseline gap-2">
          <span class="w-3 text-[#8a8371] tabular-nums">{{ index + 1 }}</span>
          <span class="truncate">{{ row.name }}</span>
          <span class="mb-0.5 flex-1 border-b border-dotted border-[#cfc6b2]" />
          <span class="font-semibold tabular-nums">{{ formatNumber(row.points, locale) }}</span>
        </li>
      </ol>
      <span
        class="mt-auto self-end rounded-[4px] bg-tile-ink-accent px-2 py-1 text-[0.65rem] font-semibold text-tile-ink-on-accent"
      >
        PDF
      </span>
    </div>
  </div>
</template>
