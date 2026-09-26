<script setup lang="ts">
// The date picker itself (vue-datepicker + date-fns): loaded on its own by
// DateField.vue, which renders DateFieldPlaceholder until it arrives. The
// theme mapping for its classes lives in DateField.vue, so the placeholder
// already looks the same.
import { VueDatePicker } from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";
import { enUS } from "date-fns/locale/en-US";
import { es } from "date-fns/locale/es";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { formatNumericDate, fromIsoDate, numericDatePattern, toIsoDate } from "../../lib/dates";
import { useLocaleStore } from "../../stores/locale";
import { useThemeStore } from "../../stores/theme";

const theme = useThemeStore();
const locale = useLocaleStore();
const { t } = useI18n();

const datePickerLocale = computed(() => (locale.locale === "en" ? enUS : es));

// v-model is a "YYYY-MM-DD" string (or "" when empty) so we don't touch any
// existing form logic (payloads, validations) that already assumes that
// format — the same contract as the native <input type="date"> it
// replaces. The Date <-> ISO conversion happens here, not through the
// picker's "model-type" prop: in text-input mode that prop doesn't always
// respect the configured format when confirming what was typed (verified
// empirically), so it's more reliable to work with a raw Date.
const model = defineModel<string>({ default: "" });

const selectedDate = computed<Date | null>({
  get: () => (model.value ? fromIsoDate(model.value) : null),
  set: (value) => {
    model.value = !value || Array.isArray(value) ? "" : toIsoDate(value);
  },
});

// Function instead of a format string: with a string ("dd/MM/yyyy") a
// programmatically preloaded value (not typed by the user) showed up
// using the browser's default format instead of ours.
/** Formats a Date for display in the picker's input, using the active locale. */
function formatDate(date: Date): string {
  return formatNumericDate(date, locale.locale);
}

// What the user types is read with the same day/month order the input
// shows: a fixed "dd/MM/yyyy" read an English "10/01/2026" as 10 January.
const textInputPattern = computed(() => numericDatePattern(locale.locale));

const props = withDefaults(
  defineProps<{
    id: string;
    placeholder?: string;
    disabled?: boolean;
    minDate?: string;
    maxDate?: string;
    // Marks the input aria-invalid while the form shows an error for it.
    invalid?: boolean;
  }>(),
  { placeholder: undefined, disabled: false, minDate: undefined, maxDate: undefined, invalid: false },
);

// The picker has no aria-describedby option, so an invalid date field is
// announced as invalid (via `state`), with its message shown right below.
const inputAttrs = computed(() => ({
  id: props.id,
  name: props.id,
  clearable: true,
  state: props.invalid ? false : undefined,
}));

const resolvedPlaceholder = computed(() => props.placeholder ?? t("dateField.placeholder"));

// The picker reads a bare "YYYY-MM-DD" as UTC midnight, i.e. the day before
// in Colombia, which made the max date itself unselectable.
const minBound = computed(() => (props.minDate ? fromIsoDate(props.minDate) : undefined));
const maxBound = computed(() => (props.maxDate ? fromIsoDate(props.maxDate) : undefined));

// The picker names its input "Datepicker input" by default, which overrides
// the <label :for="id"> every form puts next to the field.
const ARIA_LABELS = { input: undefined };
</script>

<template>
  <VueDatePicker
    v-model="selectedDate"
    :dark="theme.theme === 'dark'"
    :input-attrs="inputAttrs"
    :aria-labels="ARIA_LABELS"
    :formats="{ input: formatDate }"
    :locale="datePickerLocale"
    :time-config="{ enableTimePicker: false }"
    :disabled="disabled"
    :min-date="minBound"
    :max-date="maxBound"
    :placeholder="resolvedPlaceholder"
    :text-input="{ format: textInputPattern }"
    auto-apply
    teleport
  />
</template>
