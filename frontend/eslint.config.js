import eslintConfigPrettier from "eslint-config-prettier";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  ...tseslint.configs.recommended,
  // "essential" (not "recommended"): reglas de Vue que previenen bugs
  // reales (keys duplicadas, side-effects en computed, etc.), sin las
  // reglas de estilo tipo Prettier que trae "recommended" — este proyecto
  // no tiene Prettier todavía, así que esas solo generarían ruido.
  ...pluginVue.configs["flat/essential"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    rules: {
      // Convención del proyecto (igual que backend/eslint.config.js): un
      // parámetro prefijado con "_" es intencionalmente no usado.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Los componentes de vista/página son de un solo uso por ruta; exigir
      // nombres de varias palabras no aporta nada en este proyecto.
      "vue/multi-word-component-names": "off",
    },
  },
  // Debe ir al final: apaga cualquier regla de estilo que choque con
  // Prettier (el formato es responsabilidad de Prettier, no de ESLint).
  eslintConfigPrettier,
);
