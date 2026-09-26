<script lang="ts">
import type { Component } from "vue";

let menuModule: Promise<Component> | undefined;

/** The real menu's code, fetched once for every header on the page (a failed fetch is retried next time). */
function loadUserMenu(): Promise<Component> {
  menuModule ??= import("./UserMenu.vue").then(
    (module) => module.default,
    (error: unknown) => {
      menuModule = undefined;
      throw error;
    },
  );
  return menuModule;
}
</script>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";

import { whenIdle } from "../../lib/idle";
import { initialsOf } from "../../lib/initials";
import { useAuthStore } from "../../stores/auth";

// The user menu (with reka-ui's dropdown under it, ~30 KB) is kept off every
// page's critical path: this plain avatar button stands in for it until the
// browser is idle or the user reaches for it (pointer, focus or click). The
// real menu then takes its place: already open if the avatar was clicked,
// and focused if the keyboard was on it.
const auth = useAuthStore();
const { t } = useI18n();

const menu = shallowRef<Component | null>(null);
const standIn = useTemplateRef<HTMLButtonElement>("standIn");
const openOnMount = ref(false);
const focusOnMount = ref(false);
const initials = computed(() => initialsOf(auth.user?.name));

function load(): void {
  loadUserMenu()
    .then((component) => {
      focusOnMount.value = document.activeElement === standIn.value;
      menu.value = component;
    })
    // Offline, say: the avatar stays, and the next intent retries.
    .catch(() => undefined);
}

function openWhenLoaded(): void {
  openOnMount.value = true;
  load();
}

onMounted(() => whenIdle(load));
</script>

<template>
  <component :is="menu" v-if="menu" :open-on-mount="openOnMount" :focus-on-mount="focusOnMount" />
  <button
    v-else
    ref="standIn"
    type="button"
    class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-[#17130a] transition-opacity hover:opacity-90"
    :aria-label="t('userMenu.menuAria', { name: auth.user?.name ?? '' })"
    aria-haspopup="menu"
    aria-expanded="false"
    @pointerenter="load"
    @focus="load"
    @click="openWhenLoaded"
  >
    {{ initials }}
  </button>
</template>
