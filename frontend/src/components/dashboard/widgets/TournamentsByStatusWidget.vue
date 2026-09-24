<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { useWidgetData } from "../../../lib/useWidgetData";
import type { TournamentStatusCount } from "../../../services/dashboard";
import BarList from "../../charts/BarList.vue";
import type { BarListItem } from "../../charts/types";
import WidgetCard from "../WidgetCard.vue";

const { t } = useI18n();
const { data, loading, error, reload } = useWidgetData<TournamentStatusCount[]>("TOURNAMENTS_BY_STATUS");

const items = computed((): BarListItem[] =>
  (data.value ?? []).map((row) => ({ key: row.status, label: t(`estados.${row.status}`), value: row.count })),
);

const total = computed(() => items.value.reduce((sum, item) => sum + item.value, 0));
</script>

<template>
  <WidgetCard
    widget="TOURNAMENTS_BY_STATUS"
    :loading="loading"
    :error="error"
    :empty="total === 0"
    :empty-message="t('widgets.TOURNAMENTS_BY_STATUS.empty')"
    @retry="reload"
  >
    <div class="flex flex-col gap-4">
      <p class="text-sm">
        <strong class="text-2xl text-text">{{ total }}</strong>
        {{ t("widgets.TOURNAMENTS_BY_STATUS.total") }}
      </p>
      <BarList :items="items" :label="t('widgets.TOURNAMENTS_BY_STATUS.title')" />
    </div>
  </WidgetCard>
</template>
