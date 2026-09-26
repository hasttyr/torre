<script lang="ts">
import { defineAsyncComponent } from "vue";

import DateFieldPlaceholder from "./DateFieldPlaceholder.vue";

// The picker (vue-datepicker + date-fns, ~55 kB gzipped) is its own chunk:
// the form around it renders at once, and a read-only look-alike holds its
// place — same id, so the form's <label> still names it — until it arrives.
const DatePicker = defineAsyncComponent({
  loader: () => import("./DatePicker.vue"),
  loadingComponent: DateFieldPlaceholder,
  delay: 0,
});
</script>

<script setup lang="ts">
// v-model is a "YYYY-MM-DD" string (or "" when empty), like the native
// <input type="date"> this replaced; see DatePicker.vue for the details.
const model = defineModel<string>({ default: "" });

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
</script>

<template>
  <DatePicker v-model="model" v-bind="props" />
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
