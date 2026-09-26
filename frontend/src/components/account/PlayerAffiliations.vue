<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import { listMyCoaches, type MyCoach, type PlayerClub } from "../../services/auth";
import LoadError from "../ui/LoadError.vue";

defineProps<{ club: PlayerClub | null }>();

const { t } = useI18n();

const coaches = ref<MyCoach[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

onMounted(async () => {
  try {
    coaches.value = await listMyCoaches();
  } catch {
    loadError.value = t("account.affiliationsLoadError");
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="card mt-6">
    <h2 class="mb-1 text-lg">{{ t("account.affiliationsTitle") }}</h2>
    <p class="mb-4 text-sm">{{ t("account.affiliationsSubtitle") }}</p>

    <LoadError v-if="loadError" :message="loadError" class="mb-4" />

    <dl class="m-0">
      <div class="flex justify-between gap-4 border-b border-border-soft py-3">
        <dt class="text-sm text-text-muted">{{ t("account.clubLabel") }}</dt>
        <dd class="m-0 font-semibold">
          {{ club ? club.name : t("account.noClub") }}
        </dd>
      </div>
      <div class="py-3">
        <dt class="mb-2 text-sm text-text-muted">{{ t("account.coachesLabel") }}</dt>
        <dd class="m-0">
          <p v-if="loading" class="text-sm text-text-muted">{{ t("account.coachesLoading") }}</p>
          <p v-else-if="coaches.length === 0" class="text-sm text-text-muted">{{ t("account.noCoaches") }}</p>
          <ul v-else class="m-0 flex list-none flex-col gap-1 p-0">
            <li v-for="coach in coaches" :key="coach.id" class="text-sm font-semibold">
              {{ coach.name }}
              <span class="font-normal text-text-muted">({{ coach.email }})</span>
            </li>
          </ul>
        </dd>
      </div>
    </dl>
  </section>
</template>
