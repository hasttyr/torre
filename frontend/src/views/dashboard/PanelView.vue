<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import PlayerPicker from "../../components/dashboard/PlayerPicker.vue";
import { isRenderableWidget, WIDGET_VIEWS } from "../../components/dashboard/widgetRegistry";
import AppHeader from "../../components/layout/AppHeader.vue";
import { extractErrorMessage } from "../../lib/errors";
import { providePlayerSelection } from "../../lib/playerSelection";
import { getDashboard, type WidgetSummary } from "../../services/dashboard";
import { useAuthStore } from "../../stores/auth";

// Every role's home: renders whichever widgets the administrator assigned
// to the user's role (the administrator gets all of them). The page only
// composes; each widget loads and renders its own data.
const auth = useAuthStore();
const { t } = useI18n();

const widgets = ref<WidgetSummary[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

const hasPlayerWidgets = computed(() => widgets.value.some((widget) => widget.subject === "player"));
const selection = providePlayerSelection({ hasPlayerWidgets: () => hasPlayerWidgets.value, urlParam: "jugador" });

const role = computed(() => auth.user?.role ?? "");
const firstName = computed(() => auth.user?.name.split(/\s+/)[0] ?? "");
const noSubjects = computed(() => hasPlayerWidgets.value && selection.players.value.length === 0);

onMounted(async () => {
  try {
    const dashboard = await getDashboard();
    widgets.value = dashboard.widgets.filter((widget) => isRenderableWidget(widget.key));
    // The selected player follows: the one in the URL, else the first.
    selection.players.value = dashboard.players;
  } catch (error) {
    loadError.value = extractErrorMessage(error, t("panel.loadError"));
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container flex flex-col gap-6 py-10 sm:py-12">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-xs font-semibold tracking-[0.08em] text-accent uppercase">{{ t(`roles.${role}`) }}</p>
          <h1 class="mt-1 text-2xl sm:text-3xl">{{ t("panel.greeting", { name: firstName }) }}</h1>
          <p class="mt-1 text-sm">{{ t(`panel.subtitle.${role}`) }}</p>
        </div>
        <RouterLink v-if="role === 'ADMINISTRATOR'" to="/panel/configuracion" class="btn btn-ghost">
          {{ t("panel.configure") }}
        </RouterLink>
      </header>

      <div v-if="loading" class="grid gap-5 lg:grid-cols-2" aria-busy="true">
        <span class="sr-only">{{ t("panel.loading") }}</span>
        <div v-for="n in 4" :key="n" class="card h-52 animate-pulse" />
      </div>

      <p v-else-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>

      <p
        v-else-if="widgets.length === 0"
        class="rounded-3xl border border-dashed border-border-soft bg-surface p-10 text-center text-text-muted"
      >
        {{ t("panel.empty") }}
      </p>

      <template v-else>
        <div v-if="selection.enabled.value" class="sticky top-20 z-[5]" data-sticky-picker>
          <PlayerPicker />
        </div>

        <p v-if="noSubjects" class="banner border-border bg-surface-2 text-text-muted">
          <span>
            {{ role === "COACH" ? t("panel.noPlayersCoach") : t("panel.noPlayers") }}
            <RouterLink v-if="role === 'COACH'" to="/mis-jugadores" class="font-semibold text-accent">
              {{ t("panel.noPlayersCoachLink") }}
            </RouterLink>
          </span>
        </p>

        <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div
            v-for="widget in widgets"
            :key="widget.key"
            :class="{ 'lg:col-span-2': WIDGET_VIEWS[widget.key].wide }"
            :data-widget="widget.key"
          >
            <component :is="WIDGET_VIEWS[widget.key].component" />
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
