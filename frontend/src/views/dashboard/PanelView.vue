<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import PlayerPicker from "../../components/dashboard/PlayerPicker.vue";
import { isRenderableWidget, WIDGET_VIEWS } from "../../components/dashboard/widgetRegistry";
import WidgetSkeleton from "../../components/dashboard/WidgetSkeleton.vue";
import AppHeader from "../../components/layout/AppHeader.vue";
import LazyMount from "../../components/ui/LazyMount.vue";
import LoadError from "../../components/ui/LoadError.vue";
import { extractErrorMessage } from "../../lib/errors";
import { loadDashboard } from "../../lib/pageData";
import { providePlayerSelection } from "../../lib/playerSelection";
import { DATA_KEYS, takeData } from "../../lib/routeData";
import { prefetchWidgetData } from "../../lib/useWidgetData";
import type { WidgetSummary } from "../../services/dashboard";
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

/** A widget coming into view: its data starts loading while its code downloads. */
function prefetchWidget(widget: WidgetSummary): void {
  const playerId = widget.subject === "player" ? selection.selectedId.value : null;
  // A player widget with no player to show asks for nothing.
  if (widget.subject === "player" && !playerId) return;
  prefetchWidgetData(widget.key, playerId);
}

onMounted(async () => {
  try {
    // Usually already on its way: the route started it (lib/routeData.ts).
    const dashboard = await takeData(DATA_KEYS.panel, loadDashboard);
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

      <LoadError v-else-if="loadError" :message="loadError" />

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
            <!-- A widget far down the page loads its code and data only
                 as the user scrolls toward it, both at once. -->
            <LazyMount @visible="prefetchWidget(widget)">
              <component :is="WIDGET_VIEWS[widget.key].component" />
              <template #placeholder><WidgetSkeleton :widget="widget.key" /></template>
            </LazyMount>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
