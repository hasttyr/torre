<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "reka-ui";
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { onBeforeRouteLeave } from "vue-router";

import { isRenderableWidget } from "../../components/dashboard/widgetRegistry";
import AppHeader from "../../components/layout/AppHeader.vue";
import { useConfirm } from "../../lib/confirm";
import { extractErrorMessage } from "../../lib/errors";
import {
  CONFIGURABLE_ROLES,
  getDashboardLayouts,
  updateRoleLayout,
  type ConfigurableRole,
  type WidgetKey,
  type WidgetSummary,
} from "../../services/dashboard";

// Lets the administrator compose each role's dashboard: which widgets it
// shows and in what order. Every role keeps its own draft while switching
// tabs; nothing reaches the server until "Save" for that role.
const { t } = useI18n();
const confirm = useConfirm();

const catalog = ref<WidgetSummary[]>([]);
// Filled per role once the layouts load; until then every lookup falls back to [].
const saved = reactive<Partial<Record<ConfigurableRole, WidgetKey[]>>>({});
const drafts = reactive<Partial<Record<ConfigurableRole, WidgetKey[]>>>({});
const activeRole = ref<ConfigurableRole>("PLAYER");

const loading = ref(true);
const loadError = ref<string | null>(null);
const saving = ref(false);
const saveError = ref<string | null>(null);
const savedMessage = ref<string | null>(null);

onMounted(async () => {
  try {
    const result = await getDashboardLayouts();
    catalog.value = result.catalog.filter((widget) => isRenderableWidget(widget.key));
    for (const layout of result.layouts) {
      saved[layout.role] = [...layout.widgets];
      drafts[layout.role] = [...layout.widgets];
    }
  } catch (error) {
    loadError.value = extractErrorMessage(error, t("dashboardLayouts.loadError"));
  } finally {
    loading.value = false;
  }
});

const subjectOf = computed(() => new Map(catalog.value.map((widget) => [widget.key, widget.subject])));

const draft = computed(() => drafts[activeRole.value] ?? []);
const available = computed(() => catalog.value.filter((widget) => !draft.value.includes(widget.key)));

function isDirty(role: ConfigurableRole): boolean {
  const current = drafts[role] ?? [];
  const original = saved[role] ?? [];
  return current.length !== original.length || current.some((key, index) => key !== original[index]);
}

const anyDirty = computed(() => CONFIGURABLE_ROLES.some(isDirty));

function selectRole(role: ConfigurableRole): void {
  activeRole.value = role;
  saveError.value = null;
  savedMessage.value = null;
}

function add(key: WidgetKey): void {
  drafts[activeRole.value] = [...draft.value, key];
  savedMessage.value = null;
}

function remove(key: WidgetKey): void {
  drafts[activeRole.value] = draft.value.filter((candidate) => candidate !== key);
  savedMessage.value = null;
}

/** Swaps the widget with its neighbour one position up (-1) or down (+1). */
function move(index: number, direction: -1 | 1): void {
  const next = [...draft.value];
  [next[index], next[index + direction]] = [next[index + direction], next[index]];
  drafts[activeRole.value] = next;
  savedMessage.value = null;
}

function discard(): void {
  drafts[activeRole.value] = [...(saved[activeRole.value] ?? [])];
  saveError.value = null;
}

async function save(): Promise<void> {
  const role = activeRole.value;
  saving.value = true;
  saveError.value = null;
  try {
    const result = await updateRoleLayout(role, draft.value);
    saved[role] = [...result.widgets];
    drafts[role] = [...result.widgets];
    savedMessage.value = t("dashboardLayouts.saved", { role: t(`roles.${role}`) });
  } catch (error) {
    saveError.value = extractErrorMessage(error, t("dashboardLayouts.saveError"));
  } finally {
    saving.value = false;
  }
}

onBeforeRouteLeave(async () => {
  if (!anyDirty.value) return true;
  return confirm({
    title: t("dashboardLayouts.leaveTitle"),
    message: t("dashboardLayouts.leaveMessage"),
    confirmLabel: t("dashboardLayouts.leaveConfirm"),
    danger: true,
  });
});
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container flex flex-col gap-6 py-10 pb-28 sm:py-12 sm:pb-28">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl sm:text-3xl">{{ t("dashboardLayouts.title") }}</h1>
          <p class="mt-1 max-w-2xl text-sm">{{ t("dashboardLayouts.subtitle") }}</p>
        </div>
        <RouterLink to="/panel" class="btn btn-ghost">{{ t("dashboardLayouts.backToPanel") }}</RouterLink>
      </header>

      <p v-if="loading">{{ t("dashboardLayouts.loading") }}</p>
      <p v-else-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>

      <!-- reka-ui Tabs: arrow keys move between roles, and screen readers
           read each role's layout as the panel of its tab. -->
      <TabsRoot
        v-else
        :model-value="activeRole"
        class="flex flex-col gap-6"
        @update:model-value="(role) => selectRole(role as ConfigurableRole)"
      >
        <TabsList
          :aria-label="t('dashboardLayouts.rolesLabel')"
          class="flex flex-wrap gap-1 self-start rounded-xl border border-border-soft bg-surface p-1"
        >
          <TabsTrigger
            v-for="role in CONFIGURABLE_ROLES"
            :key="role"
            :value="role"
            class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            :class="activeRole === role ? 'bg-accent text-[#17130a]' : 'text-text-muted hover:bg-accent/10'"
          >
            {{ t(`roles.${role}`) }}
            <span class="text-xs opacity-75 tabular-nums">{{ drafts[role]?.length ?? 0 }}</span>
            <template v-if="isDirty(role)">
              <span
                class="h-1.5 w-1.5 rounded-full bg-current"
                :title="t('dashboardLayouts.unsaved')"
                aria-hidden="true"
              />
              <span class="sr-only">{{ t("dashboardLayouts.unsaved") }}</span>
            </template>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          v-for="role in CONFIGURABLE_ROLES"
          :key="role"
          :value="role"
          class="grid gap-5 lg:grid-cols-[1.1fr_1fr]"
        >
          <section
            class="card flex flex-col gap-4"
            :aria-label="t('dashboardLayouts.inPanel', { role: t(`roles.${activeRole}`) })"
          >
            <div>
              <h2 class="text-lg">{{ t("dashboardLayouts.inPanel", { role: t(`roles.${activeRole}`) }) }}</h2>
              <p class="mt-0.5 text-sm">{{ t("dashboardLayouts.inPanelHint") }}</p>
            </div>

            <p
              v-if="draft.length === 0"
              class="rounded-2xl border border-dashed border-border-soft p-6 text-center text-sm text-text-muted"
            >
              {{ t("dashboardLayouts.emptyPanel") }}
            </p>

            <ol v-else class="m-0 flex list-none flex-col gap-2 p-0">
              <li
                v-for="(key, index) in draft"
                :key="key"
                class="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface-2/40 px-3.5 py-3"
                :data-widget="key"
              >
                <span
                  class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-text tabular-nums"
                >
                  {{ index + 1 }}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-text">{{ t(`widgets.${key}.title`) }}</p>
                  <p v-if="subjectOf.get(key) === 'player'" class="text-xs text-text-faint">
                    {{ t("dashboardLayouts.perPlayer") }}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    class="icon-btn"
                    :disabled="index === 0"
                    :aria-label="t('dashboardLayouts.moveUp', { widget: t(`widgets.${key}.title`) })"
                    @click="move(index, -1)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    :disabled="index === draft.length - 1"
                    :aria-label="t('dashboardLayouts.moveDown', { widget: t(`widgets.${key}.title`) })"
                    @click="move(index, 1)"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    class="icon-btn hover:border-error/40 hover:bg-error/10 hover:text-error"
                    :aria-label="t('dashboardLayouts.remove', { widget: t(`widgets.${key}.title`) })"
                    @click="remove(key)"
                  >
                    ✕
                  </button>
                </div>
              </li>
            </ol>
          </section>

          <section class="card flex flex-col gap-4" :aria-label="t('dashboardLayouts.catalog')">
            <div>
              <h2 class="text-lg">{{ t("dashboardLayouts.catalog") }}</h2>
              <p class="mt-0.5 text-sm">{{ t("dashboardLayouts.catalogHint") }}</p>
            </div>

            <p v-if="available.length === 0" class="text-sm text-text-muted">{{ t("dashboardLayouts.allAdded") }}</p>

            <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
              <li
                v-for="widget in available"
                :key="widget.key"
                class="flex items-center gap-3 rounded-2xl border border-dashed border-border px-3.5 py-3"
                :data-available="widget.key"
              >
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-text">{{ t(`widgets.${widget.key}.title`) }}</p>
                  <p class="text-xs">{{ t(`widgets.${widget.key}.description`) }}</p>
                  <p v-if="widget.subject === 'player'" class="mt-0.5 text-xs text-text-faint">
                    {{ t("dashboardLayouts.perPlayer") }}
                  </p>
                </div>
                <button
                  type="button"
                  class="btn btn-ghost shrink-0 px-3.5 py-2 text-sm"
                  :aria-label="t('dashboardLayouts.addTo', { widget: t(`widgets.${widget.key}.title`) })"
                  @click="add(widget.key)"
                >
                  {{ t("dashboardLayouts.add") }}
                </button>
              </li>
            </ul>
          </section>
        </TabsContent>

        <p v-if="savedMessage" role="status" class="banner banner--success">{{ savedMessage }}</p>
      </TabsRoot>
    </main>

    <Transition
      enter-active-class="transition duration-180 ease-out"
      enter-from-class="opacity-0 translate-y-3"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0 translate-y-3"
    >
      <div
        v-if="!loading && isDirty(activeRole)"
        class="fixed inset-x-0 bottom-0 z-10 border-t border-border-soft bg-header backdrop-blur-md"
      >
        <div class="container flex flex-wrap items-center justify-between gap-3 py-3.5">
          <p class="text-sm text-text">
            {{ t("dashboardLayouts.pending", { role: t(`roles.${activeRole}`) }) }}
            <span v-if="saveError" role="alert" class="ml-2 text-error">{{ saveError }}</span>
          </p>
          <div class="flex gap-2">
            <button type="button" class="btn btn-ghost" :disabled="saving" @click="discard">
              {{ t("dashboardLayouts.discard") }}
            </button>
            <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
              {{ saving ? t("dashboardLayouts.saving") : t("dashboardLayouts.save") }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
