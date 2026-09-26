<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { useWidgetData } from "../../../lib/useWidgetData";
import type { UsersByRole } from "../../../services/dashboard";
import BarList from "../../charts/BarList.vue";
import type { BarListItem } from "../../charts/types";
import WidgetCard from "../WidgetCard.vue";

const { t } = useI18n();
const { data, loading, error, reload } = useWidgetData<UsersByRole[]>("USERS_BY_ROLE");

const items = computed((): BarListItem[] =>
  (data.value ?? []).map((row) => ({
    key: row.role,
    label: t(`roles.${row.role}`),
    value: row.active,
    detail: row.inactive > 0 ? t("widgets.USERS_BY_ROLE.inactive", { count: row.inactive }, row.inactive) : undefined,
  })),
);

const totalActive = computed(() => items.value.reduce((sum, item) => sum + item.value, 0));
</script>

<template>
  <WidgetCard
    widget="USERS_BY_ROLE"
    :loading="loading"
    :error="error"
    :empty="!data || data.length === 0"
    @retry="reload"
  >
    <div class="flex flex-col gap-4">
      <p class="text-sm">
        <strong class="text-2xl text-text tabular-nums">{{ totalActive }}</strong>
        {{ t("widgets.USERS_BY_ROLE.total") }}
      </p>
      <BarList :items="items" :label="t('widgets.USERS_BY_ROLE.title')" />
    </div>
  </WidgetCard>
</template>
