<script setup lang="ts">
import { useI18n } from "vue-i18n";

import MockWindow from "./MockWindow.vue";

// The five roles as chips, the arbiter's picked, and below it what an
// arbiter may and may not do.
const { t } = useI18n();

const ROLES = [
  { key: "ORGANIZER", glyph: "♔" },
  { key: "ARBITER", glyph: "♗" },
  { key: "PLAYER", glyph: "♙" },
  { key: "COACH", glyph: "♘" },
  { key: "ADMINISTRATOR", glyph: "♖" },
] as const;
const SELECTED = "ARBITER";

const PERMISSIONS = [
  { key: "permResults", allowed: true },
  { key: "permCorrect", allowed: true },
  { key: "permRoles", allowed: false },
] as const;
</script>

<template>
  <div class="flex flex-col gap-5">
    <ul class="flex flex-wrap justify-center gap-2">
      <li
        v-for="role in ROLES"
        :key="role.key"
        class="inline-flex items-center gap-1.5 rounded-full border bg-surface px-3.5 py-2 text-sm text-text"
        :class="role.key === SELECTED ? 'border-accent ring-1 ring-accent' : 'border-border-soft'"
      >
        <span class="text-base leading-none text-accent">{{ role.glyph }}</span>
        {{ t(`roles.${role.key}`) }}
      </li>
    </ul>
    <MockWindow :title="t(`roles.${SELECTED}`)">
      <ul class="flex flex-col gap-2.5 px-4 py-4 text-sm sm:px-5">
        <li v-for="permission in PERMISSIONS" :key="permission.key" class="flex items-center gap-2.5">
          <svg
            v-if="permission.allowed"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            fill="none"
            class="shrink-0 text-success"
          >
            <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
          </svg>
          <svg v-else viewBox="0 0 16 16" width="16" height="16" fill="none" class="shrink-0 text-text-faint">
            <path d="m4.5 4.5 7 7m0-7-7 7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
          </svg>
          <span :class="permission.allowed ? 'text-text' : 'text-text-faint line-through'">
            {{ t(`home.mock.${permission.key}`) }}
          </span>
        </li>
      </ul>
    </MockWindow>
  </div>
</template>
