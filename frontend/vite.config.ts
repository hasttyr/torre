import { fileURLToPath, URL } from "node:url";

import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    // Compiles the locale files into render functions at build time, so the
    // app ships vue-i18n's runtime without its message compiler (smaller,
    // and nothing to compile on the first render).
    VueI18nPlugin({
      include: [fileURLToPath(new URL("./src/i18n/locales/**", import.meta.url))],
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Vue and its plugins load on every page, together: one file
          // instead of five saves startup round trips. Only libraries the
          // entry needs belong here — anything else would load everywhere.
          groups: [{ name: "vue", test: /node_modules[\\/](@vue|vue|vue-router|pinia|vue-i18n|@intlify)[\\/]/ }],
        },
      },
    },
  },
});
