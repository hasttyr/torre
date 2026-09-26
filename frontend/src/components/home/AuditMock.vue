<script setup lang="ts">
import { useI18n } from "vue-i18n";

import MockWindow from "./MockWindow.vue";

// The latest entries of the audit log, newest first, each with who did it.
const { t } = useI18n();

const ENTRIES = [
  { time: "10:42", actionKey: "audit1", role: "ORGANIZER" },
  { time: "10:15", actionKey: "audit2", role: "ARBITER" },
  { time: "09:58", actionKey: "audit3", role: "ADMINISTRATOR" },
] as const;
</script>

<template>
  <MockWindow :title="t('home.feature6Title')">
    <ol class="flex flex-col px-4 py-4 sm:px-5">
      <li
        v-for="(entry, index) in ENTRIES"
        :key="entry.time"
        class="relative grid grid-cols-[2.75rem_1fr] gap-3 pb-4 last:pb-0"
      >
        <span class="pt-0.5 text-xs text-text-faint tabular-nums">{{ entry.time }}</span>
        <span
          class="relative border-l border-border pl-4"
          :class="{ 'border-transparent': index === ENTRIES.length - 1 }"
        >
          <span
            class="absolute top-1.5 -left-[4.5px] size-2 rounded-full"
            :class="index === 0 ? 'bg-accent' : 'bg-border'"
          />
          <span class="block text-sm font-semibold">{{ t(`home.mock.${entry.actionKey}`) }}</span>
          <span class="block text-xs text-text-muted">{{ t(`roles.${entry.role}`) }}</span>
        </span>
      </li>
    </ol>
  </MockWindow>
</template>
