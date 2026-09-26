<script setup lang="ts">
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
  }>(),
  { placeholder: undefined, disabled: false, minDate: undefined, maxDate: undefined },
);

const resolvedPlaceholder = computed(() => props.placeholder ?? t("dateField.placeholder"));

// The picker reads a bare "YYYY-MM-DD" as UTC midnight, i.e. the day before
// in Colombia, which made the max date itself unselectable.
const minBound = computed(() => (props.minDate ? fromIsoDate(props.minDate) : undefined));
const maxBound = computed(() => (props.maxDate ? fromIsoDate(props.maxDate) : undefined));
</script>

<template>
  <VueDatePicker
    v-model="selectedDate"
    :dark="theme.theme === 'dark'"
    :input-attrs="{ id, clearable: true }"
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

<style>
/* Datepicker tokens mapped to style.css's design system: it switches theme
   along with the rest of the app because it reads the same CSS variables
   (--surface, --accent, etc.), not fixed values.

   Two-class selector (higher specificity than main.css's ".dp__theme_light"/
   ".dp__theme_dark", which declare their own defaults directly on the same
   dp__main element): without this, a custom property declared directly on
   the element wins even if :root redefines it, because there :root is only
   an inherited value. */
.dp__main.dp__theme_light,
.dp__main.dp__theme_dark {
  --dp-font-family: var(--font-sans);
  --dp-border-radius: 8px;
  --dp-cell-border-radius: 8px;

  --dp-background-color: var(--surface-2);
  --dp-text-color: var(--text);
  --dp-hover-color: color-mix(in oklab, var(--accent) 15%, var(--surface-2));
  --dp-hover-text-color: var(--text);
  --dp-hover-icon-color: var(--text);
  --dp-primary-color: var(--accent);
  --dp-primary-text-color: #17130a;
  --dp-secondary-color: var(--text-muted);
  --dp-border-color: var(--border);
  --dp-menu-border-color: var(--border-soft);
  --dp-border-color-hover: color-mix(in oklab, var(--accent) 40%, var(--border));
  --dp-border-color-focus: var(--accent);
  --dp-disabled-color: var(--surface);
  --dp-disabled-color-text: var(--text-faint);
  --dp-scroll-bar-background: var(--surface-2);
  --dp-scroll-bar-color: var(--border);
  --dp-icon-color: var(--text-muted);
  --dp-danger-color: var(--error);
  --dp-highlight-color: color-mix(in oklab, var(--accent) 20%, transparent);
}

.dp__input {
  font: inherit;
  color: var(--text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.7rem 0.85rem 0.7rem 2.4rem;
}

.dp__input:hover {
  border-color: color-mix(in oklab, var(--accent) 40%, var(--border));
}

.dp__input_focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 15%, transparent);
}

.dp__theme_light,
.dp__theme_dark {
  --dp-box-shadow: var(--shadow-md);
}
</style>
