<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import type { LinePoint } from "./types";

// A single-series line over a fixed 0-100% scale (e.g. score rate per
// tournament). Hovering or focusing a point shows its tooltip; the last
// point is labelled directly. Width follows the container.
const props = defineProps<{
  points: LinePoint[];
  // Accessible name of the chart (announced by screen readers).
  label: string;
  formatValue: (value: number) => string;
}>();

const HEIGHT = 200;
const PADDING = { top: 16, right: 44, bottom: 28, left: 40 };
const GRID = [0, 0.5, 1];

const root = ref<HTMLElement | null>(null);
const width = ref(560);
const hovered = ref<number | null>(null);
let observer: ResizeObserver | undefined;

onMounted(() => {
  // jsdom (tests) has no ResizeObserver; the default width is fine there.
  if (typeof ResizeObserver === "undefined" || !root.value) return;
  observer = new ResizeObserver(([entry]) => {
    width.value = Math.max(260, entry.contentRect.width);
  });
  observer.observe(root.value);
});

onBeforeUnmount(() => observer?.disconnect());

const plotWidth = computed(() => width.value - PADDING.left - PADDING.right);
const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

function x(index: number): number {
  const steps = Math.max(1, props.points.length - 1);
  return PADDING.left + (props.points.length === 1 ? plotWidth.value / 2 : (index / steps) * plotWidth.value);
}

function y(value: number): number {
  return PADDING.top + (1 - value) * plotHeight;
}

const coordinates = computed(() =>
  props.points.map((point, index) => ({ ...point, cx: x(index), cy: y(point.value) })),
);

const linePath = computed(() =>
  coordinates.value.map((point, index) => `${index === 0 ? "M" : "L"}${point.cx},${point.cy}`).join(" "),
);

const areaPath = computed(() => {
  const points = coordinates.value;
  if (points.length < 2) return "";
  const baseline = y(0);
  return `${linePath.value} L${points[points.length - 1].cx},${baseline} L${points[0].cx},${baseline} Z`;
});

// Every x label when there's room for it, otherwise only first and last.
const showAllLabels = computed(() => plotWidth.value / Math.max(1, props.points.length) >= 56);

const tooltip = computed(() => (hovered.value === null ? null : coordinates.value[hovered.value]));

/** Hover the point nearest to the pointer's x, so the hit area is the whole column, not the 8px dot. */
function onPointerMove(event: PointerEvent): void {
  const bounds = (event.currentTarget as SVGElement).getBoundingClientRect();
  const pointerX = event.clientX - bounds.left;
  let nearest = 0;
  coordinates.value.forEach((point, index) => {
    if (Math.abs(point.cx - pointerX) < Math.abs(coordinates.value[nearest].cx - pointerX)) nearest = index;
  });
  hovered.value = nearest;
}
</script>

<template>
  <div ref="root" class="relative w-full">
    <svg
      :width="width"
      :height="HEIGHT"
      :viewBox="`0 0 ${width} ${HEIGHT}`"
      role="img"
      :aria-label="label"
      class="block max-w-full touch-none overflow-visible"
      @pointermove="onPointerMove"
      @pointerleave="hovered = null"
    >
      <g v-for="grid in GRID" :key="grid">
        <line
          :x1="PADDING.left"
          :x2="width - PADDING.right"
          :y1="y(grid)"
          :y2="y(grid)"
          class="stroke-chart-grid"
          stroke-width="1"
        />
        <text
          :x="PADDING.left - 8"
          :y="y(grid)"
          text-anchor="end"
          dominant-baseline="middle"
          class="fill-text-faint text-[11px] tabular-nums"
        >
          {{ formatValue(grid) }}
        </text>
      </g>

      <path v-if="areaPath" :d="areaPath" class="fill-chart-1" fill-opacity="0.1" />
      <path
        :d="linePath"
        fill="none"
        class="stroke-chart-1"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <line
        v-if="tooltip"
        :x1="tooltip.cx"
        :x2="tooltip.cx"
        :y1="PADDING.top"
        :y2="y(0)"
        class="stroke-border"
        stroke-width="1"
      />

      <g v-for="(point, index) in coordinates" :key="point.key">
        <circle
          :cx="point.cx"
          :cy="point.cy"
          :r="hovered === index ? 6 : 4.5"
          class="fill-chart-1 stroke-surface transition-[r]"
          stroke-width="2"
          tabindex="0"
          :aria-label="point.tooltip.join(', ')"
          @focus="hovered = index"
          @blur="hovered = null"
        />
        <text
          v-if="showAllLabels || index === 0 || index === coordinates.length - 1"
          :x="point.cx"
          :y="HEIGHT - 8"
          text-anchor="middle"
          class="fill-text-faint text-[11px]"
        >
          {{ point.label }}
        </text>
      </g>

      <text
        v-if="coordinates.length > 0"
        :x="coordinates[coordinates.length - 1].cx + 10"
        :y="coordinates[coordinates.length - 1].cy"
        dominant-baseline="middle"
        class="fill-text text-xs font-semibold tabular-nums"
      >
        {{ formatValue(coordinates[coordinates.length - 1].value) }}
      </text>
    </svg>

    <div
      v-if="tooltip"
      role="tooltip"
      class="pointer-events-none absolute z-10 w-max max-w-[16rem] -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs shadow-md"
      :style="{ left: `${Math.min(Math.max(tooltip.cx, 90), width - 90)}px`, top: `${tooltip.cy - 12}px` }"
    >
      <p class="font-semibold text-text">{{ tooltip.tooltip[0] }}</p>
      <p v-for="line in tooltip.tooltip.slice(1)" :key="line" class="text-text-muted">{{ line }}</p>
    </div>
  </div>
</template>
