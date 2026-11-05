<script setup lang="ts">
// A page's placeholder while its data loads: the shape of what's coming
// (tournament cards, table rows, log entries, a room), so nothing jumps when
// the content replaces it. The label is for screen readers only; to everyone
// else the shape says "loading". It shows after a short wait (animate-appear),
// so a fast answer never flashes it.
//
// - list:  tournament cards (name, dates, state)
// - rows:  log entries, two lines each
// - table: a searchable table in a card
// - cards: a grid of cards (dashboard widgets, settings)
// - room:  a tournament page: its kicker and name, then two cards
// - lines: a few lines inside a card that's already on screen
withDefaults(
  defineProps<{
    label: string;
    variant?: "list" | "rows" | "table" | "cards" | "room" | "lines";
    count?: number;
  }>(),
  { variant: "list", count: 3 },
);

// Varied widths, so the bones look like text rather than a barcode.
const WIDTHS = ["w-1/2", "w-2/5", "w-3/5", "w-1/3", "w-[45%]"];
const width = (index: number) => WIDTHS[index % WIDTHS.length];
</script>

<template>
  <div role="status" aria-busy="true" class="animate-appear" data-test="loading-skeleton">
    <span class="sr-only">{{ label }}</span>

    <div aria-hidden="true">
      <ul v-if="variant === 'list'" class="m-0 flex list-none flex-col gap-3 p-0">
        <li
          v-for="n in count"
          :key="n"
          class="flex flex-col items-start gap-3 rounded-[24px] pane p-6 sm:flex-row sm:items-center sm:justify-between sm:px-7"
        >
          <span class="flex w-full flex-col gap-2.5">
            <span class="skeleton h-5" :class="width(n)" />
            <span class="skeleton h-3.5 w-40" />
          </span>
          <span class="skeleton h-7 w-28 shrink-0" />
        </li>
      </ul>

      <ul v-else-if="variant === 'rows'" class="m-0 flex list-none flex-col gap-3 p-0">
        <li v-for="n in count" :key="n" class="flex flex-col gap-2.5 rounded-[22px] pane p-5">
          <span class="skeleton h-4" :class="width(n)" />
          <span class="skeleton h-3 w-1/4" />
        </li>
      </ul>

      <div v-else-if="variant === 'table'" class="card flex flex-col gap-2">
        <span class="skeleton mb-4 h-12 w-full max-w-xs rounded-2xl" />
        <div
          v-for="n in count"
          :key="n"
          class="grid grid-cols-[1.2fr_1.4fr_0.8fr] items-center gap-6 py-4 sm:grid-cols-[1.2fr_1.4fr_0.8fr_0.8fr]"
        >
          <span class="skeleton h-4" :class="n % 2 ? 'w-3/4' : 'w-2/3'" />
          <span class="skeleton h-4" :class="n % 3 ? 'w-4/5' : 'w-3/5'" />
          <span class="skeleton h-8 w-24 rounded-xl" />
          <span class="skeleton hidden h-4 w-16 sm:block" />
        </div>
      </div>

      <div v-else-if="variant === 'cards'" class="grid gap-5 lg:grid-cols-2">
        <div v-for="n in count" :key="n" class="card flex min-h-52 flex-col gap-4">
          <span class="skeleton h-5" :class="width(n)" />
          <span class="skeleton h-3.5 w-3/4" />
          <span class="mt-3 flex flex-col gap-3">
            <span class="skeleton h-3.5 w-full" />
            <span class="skeleton h-3.5 w-5/6" />
            <span class="skeleton h-3.5 w-2/3" />
          </span>
        </div>
      </div>

      <div v-else-if="variant === 'room'" class="flex flex-col gap-8">
        <div class="flex flex-col gap-3">
          <span class="skeleton h-4 w-24" />
          <span class="skeleton h-12 w-full max-w-lg" />
          <span class="skeleton h-4 w-56" />
        </div>
        <div class="grid gap-5 lg:grid-cols-2">
          <div v-for="n in 2" :key="n" class="card flex min-h-64 flex-col gap-4">
            <span class="skeleton h-5" :class="width(n)" />
            <span v-for="row in 4" :key="row" class="skeleton h-3.5" :class="row % 2 ? 'w-full' : 'w-5/6'" />
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col gap-3">
        <span v-for="n in count" :key="n" class="skeleton h-3.5" :class="n === count ? 'w-2/3' : 'w-full'" />
      </div>
    </div>
  </div>
</template>
