<script setup lang="ts">
import { VueDatePicker } from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";
import { enUS } from "date-fns/locale/en-US";
import { es } from "date-fns/locale/es";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { useLocaleStore } from "../stores/locale";
import { useThemeStore } from "../stores/theme";

const theme = useThemeStore();
const locale = useLocaleStore();
const { t } = useI18n();

const datePickerLocale = computed(() => (locale.locale === "en" ? enUS : es));

// v-model es un string "YYYY-MM-DD" (o "" vacío) para no tocar ninguna
// lógica de formularios existente (payloads, validaciones) que ya asume
// ese formato — mismo contrato que el <input type="date"> nativo que
// reemplaza. La conversión Date <-> ISO la hacemos acá, no con la prop
// "model-type" del picker: en modo texto (text-input) esa prop no siempre
// respeta el formato configurado al confirmar lo tipeado (se verificó
// empíricamente), así que es más confiable trabajar con Date crudo.
const model = defineModel<string>({ default: "" });

const fechaSeleccionada = computed<Date | null>({
  get: () => (model.value ? new Date(`${model.value}T00:00:00`) : null),
  set: (valor) => {
    if (!valor || Array.isArray(valor)) {
      model.value = "";
      return;
    }
    const yyyy = valor.getFullYear();
    const mm = String(valor.getMonth() + 1).padStart(2, "0");
    const dd = String(valor.getDate()).padStart(2, "0");
    model.value = `${yyyy}-${mm}-${dd}`;
  },
});

// Función en vez de string de formato: con un string ("dd/MM/yyyy") el
// valor precargado programáticamente (no tipeado por el usuario) se
// mostraba con el formato por defecto del navegador en vez del nuestro.
function formatearFecha(fecha: Date): string {
  const localeTag = locale.locale;
  return new Intl.DateTimeFormat(localeTag, { day: "2-digit", month: "2-digit", year: "numeric" }).format(fecha);
}

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
</script>

<template>
  <VueDatePicker
    v-model="fechaSeleccionada"
    :dark="theme.theme === 'dark'"
    :input-attrs="{ id, clearable: true }"
    :formats="{ input: formatearFecha }"
    :locale="datePickerLocale"
    :time-config="{ enableTimePicker: false }"
    :disabled="disabled"
    :min-date="minDate"
    :max-date="maxDate"
    :placeholder="resolvedPlaceholder"
    :text-input="{ format: 'dd/MM/yyyy' }"
    auto-apply
    teleport
  />
</template>

<style>
/* Tokens del datepicker mapeados al sistema de diseño de style.css: cambia
   de tema junto con el resto de la app porque lee las mismas variables
   CSS (--surface, --accent, etc.), no valores fijos.

   Selector con dos clases (mayor especificidad que ".dp__theme_light"/
   ".dp__theme_dark" de main.css, que declaran sus propios valores por
   defecto directo sobre el mismo elemento dp__main): sin esto, un
   custom property declarado directamente en el elemento gana aunque
   :root lo redefina, porque :root ahí es solo un valor heredado. */
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
